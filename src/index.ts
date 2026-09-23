import { Context, Schema, h } from "koishi";
import * as crypto from "crypto";
import { marked } from "marked";

declare module "koishi" {
  interface Context {
    server: any;
    puppeteer?: any;
  }
}

export const name = "github-webhook-pro";
export const inject = {
  required: ["server"],
  optional: ["puppeteer"]
};

export interface WebhookPayloadData {
  text: string;
  fallback: any;
  prepend?: any;
  card?: {
    type: string;
    title: string;
    repo: string;
    status: string;
    statusColor: string;
    accentColor?: string;
    author: string;
    subtitle?: string;
    url: string;
    body?: string;
  };
}

export interface Config {
  path: string;
  secret: string;
  repos: Record<string, string[]>;
  truncateLength: number;
  starThreshold: number;
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string()
    .default("/github/webhook")
    .description("Webhook 监听路径"),
  secret: Schema.string()
    .role("secret")
    .description("GitHub Webhook Secret (在 GitHub 设置中填写)"),
  repos: Schema.dict(Schema.array(Schema.string())).description(
    "仓库映射: 键为 owner/repo，值为 [平台:群号] 列表",
  ),
  truncateLength: Schema.number().default(1000).description("正文预览截断长度（默认 1000）"),
  starThreshold: Schema.number()
    .default(1)
    .description("Star 通知阈值：只有当 Star 总数是此数值的倍数时才发送通知。"),
});

export function apply(ctx: Context, config: Config) {
  // 验证签名
  const verifySignature = (payload: string, signature: string) => {
    if (!config.secret) return true;
    const hmac = crypto.createHmac("sha256", config.secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  };

  // 截断文本
  const truncate = (text: string) => {
    if (!text) return "无内容";
    const cleanText = text.replace(/\r\n/g, "\n").trim();
    return cleanText.length > config.truncateLength
      ? cleanText.substring(0, config.truncateLength) + "..."
      : cleanText;
  };

  // 尝试将文本渲染为图片，如果失败则返回原文本的 VNode
  const renderScreenshot = async (payloadData: WebhookPayloadData) => {
    if (!ctx.puppeteer) return payloadData.fallback;
    
    let html = "";
    if (payloadData.card) {
      const c = payloadData.card;
      const parsedBody = c.body ? await marked.parse(c.body) : '';
      html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            width: 700px;
            margin: 0;
            padding: 32px;
            background: #F3F2F1;
            font-family: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
            color: #201F1E;
            box-sizing: border-box;
          }
          .card {
            background: #FFFFFF;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.04), 0 0 2px rgba(0, 0, 0, 0.06);
            padding: 24px;
            border-top: 4px solid var(--accent, #0078D4);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          .type {
            font-size: 13px;
            font-weight: 600;
            color: #605E5C;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .repo {
            font-size: 14px;
            color: #0078D4;
            font-weight: 600;
          }
          .title {
            font-size: 22px;
            font-weight: 600;
            color: #201F1E;
            margin: 0 0 12px 0;
            line-height: 1.4;
          }
          .meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            color: #605E5C;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }
          .status {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            color: white;
          }
          .author {
            font-weight: 600;
            color: #323130;
          }
          .body {
            background: #F8F8F8;
            border-radius: 6px;
            padding: 16px;
            font-size: 14px;
            line-height: 1.6;
            color: #323130;
            border: 1px solid #EDEBE9;
            margin-top: 16px;
          }
          /* Markdown Styles */
          .markdown-body {
            font-family: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
            font-size: 14px;
            color: #24292f;
          }
          .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: #201F1E;
          }
          .markdown-body h1 { font-size: 2em; }
          .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #EDEBE9; padding-bottom: .3em; }
          .markdown-body h3 { font-size: 1.25em; }
          .markdown-body p { margin-top: 0; margin-bottom: 16px; }
          .markdown-body a { color: #0078D4; text-decoration: none; }
          .markdown-body a:hover { text-decoration: underline; }
          .markdown-body blockquote {
            padding: 0 1em;
            color: #605E5C;
            border-left: .25em solid #D2D0CE;
            margin: 0 0 16px 0;
          }
          .markdown-body pre {
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            background-color: #F3F2F1;
            border-radius: 6px;
          }
          .markdown-body code {
            padding: .2em .4em;
            margin: 0;
            font-size: 85%;
            background-color: #F3F2F1;
            border-radius: 6px;
            font-family: Consolas, 'Courier New', monospace;
          }
          .markdown-body pre code {
            padding: 0;
            background-color: transparent;
            border: 0;
          }
          .markdown-body ul, .markdown-body ol {
            padding-left: 2em;
            margin-top: 0;
            margin-bottom: 16px;
          }
          .markdown-body img {
            max-width: 100%;
            box-sizing: content-box;
          }
          
          .footer {
            margin-top: 16px;
            font-size: 12px;
            color: #A19F9D;
          }
        </style>
      </head>
      <body>
        <div class="card" style="--accent: ${c.accentColor || '#0078D4'}">
          <div class="header">
            <div class="type">${c.type}</div>
            <div class="repo">${c.repo}</div>
          </div>
          <h1 class="title">${c.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
          <div class="meta">
            ${c.status ? `<span class="status" style="background: ${c.statusColor}">${c.status}</span>` : ''}
            <span>由 <span class="author">${c.author}</span> 触发</span>
            ${c.subtitle ? `<span>${c.subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>` : ''}
          </div>
          ${parsedBody ? `<div class="body markdown-body">${parsedBody}</div>` : ''}
          <div class="footer">
            ${c.url}
          </div>
        </div>
      </body>
      </html>
      `;
    } else {
      html = `
      <!DOCTYPE html>
      <html style="background: white;">
        <head>
          <meta charset="utf-8">
        </head>
        <body style="width: 600px; padding: 20px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; font-size: 16px; color: #24292f; line-height: 1.5;">
          <div style="white-space: pre-wrap; word-wrap: break-word;">${payloadData.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </body>
      </html>
      `;
    }

    try {
      const imageStr = await ctx.puppeteer.render(html);
      return h.parse(imageStr);
    } catch (e) {
      ctx.logger("github-webhook").warn("Screenshot rendering failed, falling back to text:", e);
      return payloadData.fallback;
    }
  };

  // 路由处理
  ctx.server.post(config.path, async (c) => {
    const headers = c.headers || c.req?.header || {};
    const eventType = headers["x-github-event"] || headers["X-Github-Event"];
    const signature = (headers["x-hub-signature-256"] ||
      headers["X-Hub-Signature-256"]) as string;

    let payload = c.request?.body;
    if (!payload && c.req && typeof c.req.json === "function") {
      try {
        payload = await c.req.json();
      } catch (e) {}
    }

    // --- 修复点 1：Payload 校验 ---
    if (!payload) {
      c.status = 400;
      c.body = "Invalid Payload";
      return;
    }

    if (config.secret && !verifySignature(JSON.stringify(payload), signature)) {
      // 如果需要取消注释，请使用:
      // c.status = 403; c.body = 'Signature mismatch'; return;
    }

    const repoName = payload.repository?.full_name;

    // --- 修复点 2：仓库配置校验 ---
    if (!repoName || !config.repos[repoName]) {
      c.status = 200;
      c.body = "Repository not configured";
      return;
    }

    let payloadData: any = null;

    try {
      switch (eventType) {
        case "issues":
          payloadData = handleIssue(payload, config);
          break;
        case "pull_request":
          payloadData = handlePullRequest(payload, config);
          break;
        case "release":
          payloadData = handleRelease(payload, config);
          break;
        case "star":
        case "watch":
          payloadData = handleStar(payload, config);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("Error parsing GitHub webhook:", e);
    }

    if (payloadData) {
      let finalMessage: any = await renderScreenshot(payloadData);
      if (payloadData.prepend && finalMessage !== payloadData.fallback) {
        const prepends = Array.isArray(payloadData.prepend) ? payloadData.prepend : [payloadData.prepend];
        const finals = Array.isArray(finalMessage) ? finalMessage : [finalMessage];
        finalMessage = h("message", [...prepends, ...finals]);
      }

      const targets = config.repos[repoName];
      for (const target of targets) {
        const [platform, channelId] = target.split(":");
        if (platform && channelId) {
          const bot = ctx.bots.find((b) => b.platform === platform);
          if (bot) {
            await bot.sendMessage(channelId, finalMessage);
          } else {
            await ctx.broadcast([target], finalMessage);
          }
        }
      }
    }

    // --- 修复点 3：返回成功状态 ---
    c.status = 200;
    c.body = "OK";
    return;
  });

  // --- 测试指令 (新增) ---
  // 仅超级管理员可用 (authority: 4) 或者你可以去掉这个 check

  const cmd = ctx.command("github", "GitHub Webhook 测试工具").alias("gh");

  cmd
    .subcommand(".test-issue [repo:string]", "模拟 Issue 事件")
    .action(async ({ session }, repo = "koishi/test-repo") => {
      await session.send("正在生成测试 Issue...");
      const payload = {
        action: "opened",
        repository: { full_name: repo },
        issue: {
          number: Math.floor(Math.random() * 1000),
          title: "这是一个测试 Issue 标题",
          html_url: `https://github.com/${repo}/issues/1`,
          body: "这是一段测试内容。\n\n这里有一些详细的描述，用于测试截断功能是否正常工作。",
        },
        sender: { login: session.username || "TestUser" },
      };
      const data = handleIssue(payload, config);
      if (!data) return "生成失败";
      const finalMsg = await renderScreenshot(data);
      if (data.prepend && finalMsg !== data.fallback) {
        const prepends = Array.isArray(data.prepend) ? data.prepend : [data.prepend];
        const finals = Array.isArray(finalMsg) ? finalMsg : [finalMsg];
        return h("message", [...prepends, ...finals]);
      }
      return finalMsg;
    });

  cmd
    .subcommand(".test-pr [repo:string]", "模拟 PR 事件")
    .action(async ({ session }, repo = "koishi/test-repo") => {
      await session.send("正在生成测试 PR...");
      const payload = {
        action: "opened",
        repository: { full_name: repo },
        pull_request: {
          number: Math.floor(Math.random() * 1000),
          title: "Feat: 添加了一个很酷的新功能",
          html_url: `https://github.com/${repo}/pull/1`,
          head: { ref: "feat/new-ui" },
          base: { ref: "main" },
          body: "这里是 PR 的详细描述...\n- 修改了 A\n- 修复了 B",
        },
        sender: { login: session.username || "TestUser" },
      };
      const data = handlePullRequest(payload, config);
      if (!data) return "生成失败";
      const finalMsg = await renderScreenshot(data);
      if (data.prepend && finalMsg !== data.fallback) {
        const prepends = Array.isArray(data.prepend) ? data.prepend : [data.prepend];
        const finals = Array.isArray(finalMsg) ? finalMsg : [finalMsg];
        return h("message", [...prepends, ...finals]);
      }
      return finalMsg;
    });

  cmd
    .subcommand(".test-release [repo:string]", "模拟 Release 事件")
    .action(async ({ session }, repo = "koishi/test-repo") => {
      const payload = {
        action: "published",
        repository: { full_name: repo },
        release: {
          tag_name: "v1.0.0",
          name: "v1.0.0 - Major Update",
          html_url: `https://github.com/${repo}/releases/tag/v1.0.0`,
          published_at: new Date().toISOString(),
          body: `## 🎉 新特性\n- 移除了 Puppeteer 依赖\n- 改为纯文本输出\n\n## 🐛 修复\n- 修复了渲染慢的问题`,
        },
        sender: { login: "TestUser" },
      };
      const data = handleRelease(payload, config);
      if (!data) return "生成失败";
      const finalMsg = await renderScreenshot(data);
      if (data.prepend && finalMsg !== data.fallback) {
        const prepends = Array.isArray(data.prepend) ? data.prepend : [data.prepend];
        const finals = Array.isArray(finalMsg) ? finalMsg : [finalMsg];
        return h("message", [...prepends, ...finals]);
      }
      return finalMsg;
    });

  cmd
    .subcommand(".test-star [repo:string] [count:number]", "模拟 Star 事件")
    .action(async ({ session }, repo = "koishi/test-repo", count = 10) => {
      const payload = {
        action: "created",
        repository: {
          full_name: repo,
          stargazers_count: count,
          html_url: `https://github.com/${repo}`,
        },
        sender: { login: session.username || "TestUser" },
      };
      // 临时修改阈值以确保能触发，或者用户自己输入满足阈值的数字
      // 这里为了测试方便，强制认为命中
      const originalThreshold = config.starThreshold;
      config.starThreshold = 1;
      const data = handleStar(payload, config);
      config.starThreshold = originalThreshold; // 恢复
      if (!data) return "未触发通知（可能未达到阈值）";
      const finalMsg = await renderScreenshot(data);
      if (data.prepend && finalMsg !== data.fallback) {
        const prepends = Array.isArray(data.prepend) ? data.prepend : [data.prepend];
        const finals = Array.isArray(finalMsg) ? finalMsg : [finalMsg];
        return h("message", [...prepends, ...finals]);
      }
      return finalMsg;
    });

  // --- 处理函数 ---

  function handleIssue(payload: any, config: Config): WebhookPayloadData | null {
    const { action, issue, repository, sender } = payload;
    if (!["opened", "closed", "reopened"].includes(action)) return null;

    const statusMap: Record<string, string> = {
      opened: "已开启",
      closed: "已关闭",
      reopened: "已重新开启",
    };
    const statusCN = statusMap[action] || action;

    const statusColorMap: Record<string, string> = {
      opened: "#238636",
      closed: "#8957E5",
      reopened: "#238636",
    };
    const statusColor = statusColorMap[action] || "#0078D4";

    const textParts = [
      `[Issue 动态] ${repository.full_name} #${issue.number}`,
      `标题: ${issue.title}`,
      `状态: ${statusCN}`,
      `提交者: ${sender.login}`,
      `链接: ${issue.html_url}`
    ];
    if (action === "opened") {
      textParts.push(`\n=== 内容摘要 ===\n${truncate(issue.body)}`);
    }
    const textContent = textParts.join('\n');

    return {
      text: textContent,
      fallback: h("message", [h.text(textContent)]),
      prepend: h.text(`[Issue 动态] ${repository.full_name} #${issue.number}\n标题: ${issue.title}\n`),
      card: {
        type: "Issue",
        title: issue.title,
        repo: `${repository.full_name} #${issue.number}`,
        status: statusCN,
        statusColor: statusColor,
        author: sender.login,
        url: issue.html_url,
        body: action === "opened" ? issue.body : undefined,
        accentColor: statusColor
      }
    };
  }

  function handlePullRequest(payload: any, config: Config): WebhookPayloadData | null {
    const { action, pull_request, repository, sender } = payload;

    let statusCN = "";
    let statusColor = "#0078D4";
    if (action === "opened") {
      statusCN = "已开启";
      statusColor = "#238636";
    } else if (action === "reopened") {
      statusCN = "已重新开启";
      statusColor = "#238636";
    } else if (action === "closed") {
      statusCN = pull_request.merged ? "已合并 (Merged)" : "已关闭 (未合并)";
      statusColor = pull_request.merged ? "#8957E5" : "#DA3633";
    } else {
      return null;
    }

    const textParts = [
      `[合并请求 PR] ${repository.full_name} #${pull_request.number}`,
      `标题: ${pull_request.title}`,
      `分支: ${pull_request.head.ref} -> ${pull_request.base.ref}`,
      `状态: ${statusCN}`,
      `操作者: ${sender.login}`,
      `链接: ${pull_request.html_url}`
    ];
    if (action === "opened") {
      textParts.push(`\n=== 内容摘要 ===\n${truncate(pull_request.body)}`);
    }
    const textContent = textParts.join('\n');

    return {
      text: textContent,
      fallback: h("message", [h.text(textContent)]),
      prepend: h.text(`[合并请求 PR] ${repository.full_name} #${pull_request.number}\n标题: ${pull_request.title}\n`),
      card: {
        type: "Pull Request",
        title: pull_request.title,
        repo: `${repository.full_name} #${pull_request.number}`,
        status: statusCN,
        statusColor: statusColor,
        author: sender.login,
        subtitle: `分支: ${pull_request.head.ref} &rarr; ${pull_request.base.ref}`,
        url: pull_request.html_url,
        body: action === "opened" ? pull_request.body : undefined,
        accentColor: statusColor
      }
    };
  }

  function handleRelease(payload: any, config: Config): WebhookPayloadData | null {
    const { action, release, repository, sender } = payload;
    if (action !== "published") return null;

    const tagName = release.tag_name;
    const repoName = repository.full_name;
    const title = release.name || tagName;
    const author = sender.login;
    const body = release.body || "*(No description provided)*";
    const url = release.html_url;

    const textContent = `🚀 [新版本发布] ${repoName}\n版本号: ${tagName}\n标题: ${title}\n发布者: ${author}\n🔗 链接: ${url}\n\n=== 内容摘要 ===\n${truncate(body)}`;

    return {
      text: textContent,
      prepend: [h.at("all"), h.text(`\n🚀 [新版本发布] ${repoName}\n版本号: ${tagName}\n标题: ${title}\n`)],
      fallback: h("message", [h.at("all"), h.text("\n" + textContent)]),
      card: {
        type: "Release",
        title: title,
        repo: repoName,
        status: tagName,
        statusColor: "#0078D4",
        author: author,
        url: url,
        body: body,
        accentColor: "#0078D4"
      }
    };
  }

  function handleStar(payload: any, config: Config): WebhookPayloadData | null {
    if (payload.action !== "created") return null;

    const count = payload.repository.stargazers_count;
    const sender = payload.sender.login;
    const repoName = payload.repository.full_name;

    if (count % config.starThreshold !== 0) return null;

    const textContent = `⭐ [Star 关注] ${repoName}\n当前 Star 总数: ${count}\n新增关注者: ${sender}\n链接: ${payload.repository.html_url}`;

    return {
      text: textContent,
      fallback: h("message", [h.text(textContent)]),
      prepend: h.text(`⭐ [Star 关注] ${repoName}\n当前 Star 总数: ${count}\n`),
      card: {
        type: "Star",
        title: "New Star!",
        repo: repoName,
        status: `${count} Stars`,
        statusColor: "#DCA550",
        author: sender,
        url: payload.repository.html_url,
        accentColor: "#DCA550"
      }
    };
  }
}
