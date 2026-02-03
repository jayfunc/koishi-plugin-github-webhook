import { Context, Schema, h } from 'koishi'
import * as crypto from 'crypto'

declare module 'koishi' {
  interface Context {
    server: any,
    puppeteer: any
  }
}

export const name = 'github-webhook-pro'
export const inject = ['server', 'puppeteer']

export interface Config {
  path: string
  secret: string
  repos: Record<string, string[]>
  truncateLength: number
  starThreshold: number
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().default('/github/webhook').description('Webhook 监听路径'),
  secret: Schema.string().role('secret').description('GitHub Webhook Secret (在 GitHub 设置中填写)'),
  repos: Schema.dict(Schema.array(Schema.string())).description('仓库映射: 键为 owner/repo，值为 [平台:群号] 列表'),
  truncateLength: Schema.number().default(200).description('正文预览截断长度'),
  starThreshold: Schema.number().default(1).description('Star 通知阈值：只有当 Star 总数是此数值的倍数时才发送通知。')
})

export function apply(ctx: Context, config: Config) {
  // 验证签名
  const verifySignature = (payload: string, signature: string) => {
    if (!config.secret) return true
    const hmac = crypto.createHmac('sha256', config.secret)
    const digest = 'sha256=' + hmac.update(payload).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  }

  // 截断文本
  const truncate = (text: string) => {
    if (!text) return '无内容'
    const cleanText = text.replace(/\r\n/g, '\n').trim()
    return cleanText.length > config.truncateLength ? cleanText.substring(0, config.truncateLength) + '...' : cleanText
  }

  // 路由处理
  ctx.server.post(config.path, async (c) => {
    const headers = c.headers || c.req?.header || {}
    const eventType = headers['x-github-event'] || headers['X-Github-Event']
    const signature = (headers['x-hub-signature-256'] || headers['X-Hub-Signature-256']) as string

    let payload = c.request?.body
    if (!payload && c.req && typeof c.req.json === 'function') {
      try { payload = await c.req.json() } catch (e) {}
    }

    // --- 修复点 1：Payload 校验 ---
    if (!payload) {
      c.status = 400
      c.body = 'Invalid Payload'
      return
    }

    if (config.secret && !verifySignature(JSON.stringify(payload), signature)) {
      // 如果需要取消注释，请使用:
      // c.status = 403; c.body = 'Signature mismatch'; return;
    }

    const repoName = payload.repository?.full_name

    // --- 修复点 2：仓库配置校验 ---
    if (!repoName || !config.repos[repoName]) {
      c.status = 200
      c.body = 'Repository not configured'
      return
    }

    let message: any = null

    try {
      switch (eventType) {
        case 'issues':
          message = handleIssue(payload, config)
          break
        case 'pull_request':
          message = handlePullRequest(payload, config)
          break
        case 'release':
          message = await handleRelease(payload, config, ctx)
          break
        case 'star':
        case 'watch':
          message = handleStar(payload, config)
          break
        default:
          break
      }
    } catch (e) {
      console.error('Error parsing GitHub webhook:', e)
    }

    if (message) {
      const targets = config.repos[repoName]
      for (const target of targets) {
        const [platform, channelId] = target.split(':')
        if (platform && channelId) {
          const bot = ctx.bots.find(b => b.platform === platform)
          if (bot) {
            await bot.sendMessage(channelId, message)
          } else {
            await ctx.broadcast([target], message)
          }
        }
      }
    }

    // --- 修复点 3：返回成功状态 ---
    c.status = 200
    c.body = 'OK'
    return
  })

  // --- 处理函数 ---

  function handleIssue(payload: any, config: Config) {
    const { action, issue, repository, sender } = payload
    if (!['opened', 'closed', 'reopened'].includes(action)) return null

    const statusMap: Record<string, string> = {
      opened: '已开启',
      closed: '已关闭',
      reopened: '已重新开启'
    }
    const statusCN = statusMap[action] || action

    return h('message', [
      h.text(`[Issue 动态] ${repository.full_name} #${issue.number}`),
      h.text(`\n标题: ${issue.title}`),
      h.text(`\n状态: ${statusCN}`),
      h.text(`\n提交者: ${sender.login}`),
      h.text(`\n链接: ${issue.html_url}`),
      action === 'opened' ? h.text(`\n\n=== 内容摘要 ===\n${truncate(issue.body)}`) : null
    ])
  }

  function handlePullRequest(payload: any, config: Config) {
    const { action, pull_request, repository, sender } = payload

    let statusCN = ''
    if (action === 'opened') {
      statusCN = '已开启'
    } else if (action === 'reopened') {
      statusCN = '已重新开启'
    } else if (action === 'closed') {
      statusCN = pull_request.merged ? '已合并 (Merged)' : '已关闭 (未合并)'
    } else {
      return null
    }

    return h('message', [
      h.text(`[合并请求 PR] ${repository.full_name} #${pull_request.number}`),
      h.text(`\n标题: ${pull_request.title}`),
      h.text(`\n分支: ${pull_request.head.ref} -> ${pull_request.base.ref}`),
      h.text(`\n状态: ${statusCN}`),
      h.text(`\n操作者: ${sender.login}`),
      h.text(`\n链接: ${pull_request.html_url}`),
      action === 'opened' ? h.text(`\n\n=== 内容摘要 ===\n${truncate(pull_request.body)}`) : null
    ])
  }

    async function handleRelease(payload: any, config: Config, ctx: Context) {
    const { action, release, repository, sender } = payload
    if (action !== 'published') return null

    // 1. 数据准备
    const tagName = release.tag_name
    const repoName = repository.full_name
    const title = release.name || tagName
    const author = sender.login
    const body = release.body || '*(No description provided)*'
    const url = release.html_url
    const publishedAt = new Date(release.published_at).toLocaleString('zh-CN')

    // 2. 渲染 HTML (使用 CDN 引入 Markdown 渲染器和 CSS)
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css">
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <style>
        body {
          background: #fff; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          width: 800px; /* 固定宽度，防止图片过宽 */
        }
        .header { border-bottom: 1px solid #eaecef; padding-bottom: 16px; margin-bottom: 24px; }
        .repo-name { font-size: 20px; color: #586069; margin-bottom: 8px; }
        .release-title { font-size: 32px; font-weight: 600; color: #24292e; margin: 0; display: flex; align-items: center; gap: 10px; }
        .tag { background: #0366d6; color: white; padding: 4px 10px; border-radius: 20px; font-size: 16px; font-weight: normal; vertical-align: middle; }
        .meta { margin-top: 10px; color: #586069; font-size: 14px; }
        .markdown-body { font-size: 16px; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="repo-name">📦 ${repoName}</div>
        <h1 class="release-title">
          ${title}
          <span class="tag">${tagName}</span>
        </h1>
        <div class="meta">
          发布者: <strong>${author}</strong> &nbsp;|&nbsp; 时间: ${publishedAt}
        </div>
      </div>

      <div id="content" class="markdown-body"></div>

      <script>
        // 将 Markdown 注入
        const md = ${JSON.stringify(body)};
        document.getElementById('content').innerHTML = marked.parse(md);
      </script>
    </body>
    </html>
    `

    // 3. 使用 Puppeteer 截图
    let imgBuf: Buffer
    try {
      imgBuf = await ctx.puppeteer.render(html, async (page, next) => {
        // 设置视口
        await page.setViewport({ width: 840, height: 100 })
        // 等待页面渲染（尤其是 marked.js 执行）
        await page.waitForSelector('#content', { timeout: 10000 })
        // 截图整个 body
        const element = await page.$('body')
        return await element.screenshot({ type: 'png', encoding: 'binary' })
      })
    } catch (e) {
      console.error('Render Error:', e)
      return h.text(`⚠️ 图片渲染失败，请查看后台日志。\n版本: ${tagName}`)
    }

    // 4. 返回消息结构
    // h.at('all') 必须放在最前面
    return h('message', [
      h.at('all'),
      h.text('\n'), // 换行，稍微美观点
      h.text(`🚀 [新版本发布] ${repository.full_name}`),
      h.text(`\n版本号: ${release.tag_name}`),
      h.image(imgBuf, 'image/png'),
      h.text(`\n🔗 Release 链接: ${url}`)
    ])
  }

  function handleStar(payload: any, config: Config) {
    if (payload.action !== 'created') return null

    const count = payload.repository.stargazers_count
    const sender = payload.sender.login
    const repoName = payload.repository.full_name

    if (count % config.starThreshold !== 0) return null

    return h('message', [
      h.text(`⭐ [Star 关注] ${repoName}`),
      h.text(`\n当前 Star 总数: ${count}`),
      h.text(`\n新增关注者: ${sender}`),
      h.text(`\n链接: ${payload.repository.html_url}`)
    ])
  }
}
