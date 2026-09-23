# koishi-plugin-github-webhook

![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=flat-square)

[English](./README.md) | 中文文档

一个功能强大的 Koishi GitHub Webhook 插件。支持多仓库分发、密钥验证，并且**使用 Puppeteer 将 Issue、PR、Release 以及 Star 的动态以 Fluent Design 风格渲染为美观的卡片长图**发送，避免文字刷屏且完美保留 Markdown 格式！

## ✨ 功能特性

* **多事件支持**：支持 `Issue`、`Pull Request`、`Release`、`Star` 事件推送。
* **Fluent Design 卡片渲染**：自动将推送事件（包含正文的 Markdown 内容）渲染为微软 Fluent 风格的精美卡片长图发送。
* **优雅降级**：如果未配置截图服务或截图失败，插件会自动降级为纯文本格式发送，防止漏发。
* **安全验证**：支持 GitHub Webhook Secret 签名验证（HMAC SHA-256）。
* **Star 阈值通知**：支持设置 Star 计数倍数通知（例如每增 10 个 Star 通知一次），避免大仓库频繁刷屏。
* **灵活分发**：支持将不同仓库的动态推送到不同的平台和群组/频道。
* **测试指令**：内置了方便的模拟测试指令。

## 📦 安装

此插件尚未发布到 npm，请使用 git 安装：
```bash
npm install github:jayfunc/koishi-plugin-github-webhook
```

> ⚠️ **注意**：本插件使用 `puppeteer` 服务用于渲染精美图片，并依赖 `marked` 解析 Markdown。请确保你已安装并配置了 `koishi-plugin-puppeteer`，并执行了 `npm install`。

## ⚙️ 配置说明

### 插件配置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `path` | `string` | `/github/webhook` | Koishi 监听的 Webhook 路径 |
| `secret` | `string` | - | GitHub Webhook Secret (推荐设置) |
| `repos` | `object` | `{}` | 仓库映射配置，详情见下文 |
| `truncateLength` | `number` | `1000` | （文本回退模式下）正文预览截断长度 |
| `starThreshold` | `number` | `1` | Star 通知阈值(如设为 10，则 10, 20, 30... 时通知) |

### 仓库映射 (`repos`)

`repos` 是一个键值对对象：
* **Key**: GitHub 仓库全名 (例如 `koishijs/koishi`)
* **Value**: 目标推送列表，格式为 `平台:群号/频道号`

**YAML 配置示例：**

```yaml
plugins:
  github-webhook-pro:
    path: /github/webhook
    secret: my_super_secure_token
    truncateLength: 1000
    starThreshold: 5
    repos:
      # 当 koishijs/koishi 有动态时，推送到 onebot 平台的 123456 群
      koishijs/koishi:
        - onebot:123456

      # 当 my-org/backend 有动态时，同时推送到 discord 和 telegram
      my-org/backend:
        - discord:9876543210
        - telegram:-10012345678
```

## 🔧 GitHub 设置指南

1.  进入你的 GitHub 仓库页面。
2.  点击 **Settings** -> **Webhooks** -> **Add webhook**。
3.  填写以下信息：
    * **Payload URL**: `http://你的机器人IP:端口/github/webhook` (需与配置中的 `path` 一致)
    * **Content type**: 选择 `application/json` (**必须选这个，否则无法解析**)
    * **Secret**: 填写你在插件配置中设置的 `secret`。
4.  **Which events would you like to trigger this webhook?**
    * 建议选择 **Let me select individual events**，并勾选：
        * Issues
        * Pull requests
        * Releases
        * Stars (Watch)
5.  点击 **Add webhook**。

## 🛠️ 测试指令

为方便调试，插件提供了几个用于模拟 GitHub Webhook 推送的测试指令（默认 `authority: 1` 即可使用）：
- `gh .test-issue [repo]`：模拟 Issue 事件
- `gh .test-pr [repo]`：模拟 Pull Request 事件
- `gh .test-release [repo]`：模拟 Release 事件
- `gh .test-star [repo] [count]`：模拟 Star 事件

> 示例: `gh .test-issue koishi/test-repo`

## 🖼️ 效果预览

插件会自动识别各类事件类型并设置合适的主题色，利用 Markdown 渲染引擎将其转换为漂亮的 Fluent 卡片发送。并在发送图片的同时，附带一段简短的文本提示，方便用户在未打开大图时一目了然！

> [Issue 动态] user/repo #12
> 标题: 修复了一个严重的 Bug
> [图片: Fluent 风格的美观长图，包含 Markdown 解析后的完整正文]

## 📝 开发与贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
