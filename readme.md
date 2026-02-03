# koishi-plugin-github-webhook

![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=flat-square)

一个功能强大的 Koishi GitHub Webhook 插件。支持多仓库分发、密钥验证，并且**使用 Puppeteer 将 Release 更新日志渲染为长图**，美观且信息量大。

## ✨ 功能特性

* **多事件支持**：支持 `Issue`、`Pull Request`、`Release`、`Star` 事件推送。
* **Release 图片渲染**：自动将 Release Note（Markdown 格式）渲染为精美的长图发送，避免刷屏且保留格式。
* **安全验证**：支持 GitHub Webhook Secret 签名验证（HMAC SHA-256）。
* **Star 阈值通知**：支持设置 Star 计数倍数通知（例如每满 10 个 Star 通知一次），避免大仓库频繁刷屏。
* **灵活分发**：支持将不同仓库的动态推送到不同的平台和群组/频道。

## 📦 安装

此插件尚未发布到 npm，请使用 git 安装：

```bash
npm install github:jayfunc/koishi-plugin-github-webhook
```

> ⚠️ **注意**：本插件依赖 `puppeteer` 服务用于渲染 Release 图片。请确保你已安装并配置了 `koishi-plugin-puppeteer`。

## ⚙️ 配置说明

### 插件配置

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `path` | `string` | `/github/webhook` | Koishi 监听的 Webhook 路径 |
| `secret` | `string` | - | GitHub Webhook Secret (推荐设置) |
| `repos` | `object` | `{}` | 仓库映射配置，详情见下文 |
| `truncateLength` | `number` | `200` | Issue/PR 内容预览的截断长度 |
| `starThreshold` | `number` | `1` | Star 通知阈值 (如设为 10，则 10, 20, 30... 时通知) |

### 仓库映射 (`repos`)

`repos` 是一个键值对对象：
* **Key**: GitHub 仓库全名 (例如 `koishijs/koishi`)
* **Value**: 目标推送列表，格式为 `平台名:群号/频道号`

**YAML 配置示例：**

```yaml
plugins:
  github-webhook-pro:
    path: /github/webhook
    secret: my_super_secure_token
    truncateLength: 150
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

## 🖼️ 效果预览

### Release 发布
插件会自动抓取 Release Body 中的 Markdown，加载 GitHub 样式 CSS，并通过 Puppeteer 截图发送：

> [图片: Release 更新日志长图]

### Issue / PR
> [Issue 动态] user/repo #12
> 标题: 修复了一个严重的 Bug
> 状态: 已开启
> ...

## 📝 开发与贡献

欢迎提交 Issue 和 Pull Request。

## 📄 License

MIT
