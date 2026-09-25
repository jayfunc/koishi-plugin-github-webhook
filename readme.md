# koishi-plugin-github-webhook

![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=flat-square)

English | [中文文档](./README.CN.md)

A powerful GitHub Webhook plugin for Koishi. It supports multi-repository routing, secret verification, and **uses Puppeteer to render Issues, Pull Requests, Discussions, Releases, and Stars into beautiful Fluent Design-style long screenshot cards**, avoiding text flooding while perfectly preserving Markdown formatting!

## ✨ Features

* **Multi-event Support**: Supports `Issue`, `Pull Request`, `Discussion`, `Release`, and `Star` push events.
* **Fluent Design Card Rendering**: Automatically renders push events (including the Markdown body text) into elegant Microsoft Fluent-style long screenshot cards.
* **Graceful Degradation**: If the screenshot service is not configured or screenshot generation fails, the plugin automatically falls back to plain text format to prevent missed notifications.
* **Security Verification**: Supports GitHub Webhook Secret verification (HMAC SHA-256).
* **Star Threshold Notifications**: Set a multiplier for Star notifications (e.g., notify every 10 Stars) to avoid spamming for large repositories.
* **Flexible Routing**: Route updates from different repositories to specific platforms and groups/channels independently.
* **Testing Commands**: Includes convenient commands to simulate GitHub Webhook pushes for debugging.

## 📦 Installation

This plugin is not yet published to npm. Please install it via git:
```bash
npm install github:jayfunc/koishi-plugin-github-webhook
```

> ⚠️ **Note**: This plugin relies on the `puppeteer` service to render beautiful images, and `marked` to parse Markdown. Ensure that `koishi-plugin-puppeteer` is installed and configured, and that you have run `npm install` for dependencies.

## ⚙️ Configuration

### Plugin Config

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | `/github/webhook` | Webhook listening path for Koishi |
| `secret` | `string` | - | GitHub Webhook Secret (Recommended) |
| `repos` | `object` | `{}` | Repository mapping config (see below) |
| `truncateLength` | `number` | `1000` | Truncation length for text body previews (in text-fallback mode) |
| `starThreshold` | `number` | `1` | Star notification threshold (e.g., if 10, triggers at 10, 20, 30...) |

### Repository Mapping (`repos`)

The `repos` config is a key-value object:
* **Key**: Full GitHub repository name (e.g., `koishijs/koishi`)
* **Value**: List of target chat locations, formatted as `platform:channel_id/group_id`

**YAML Configuration Example:**

```yaml
plugins:
  github-webhook-pro:
    path: /github/webhook
    secret: my_super_secure_token
    truncateLength: 1000
    starThreshold: 5
    repos:
      # Send koishijs/koishi updates to group 123456 on the onebot platform
      koishijs/koishi:
        - onebot:123456

      # Send my-org/backend updates to both discord and telegram
      my-org/backend:
        - discord:9876543210
        - telegram:-10012345678
```

## 🔧 GitHub Setup Guide

1.  Navigate to your GitHub repository page.
2.  Click **Settings** -> **Webhooks** -> **Add webhook**.
3.  Fill in the following details:
    * **Payload URL**: `http://<your-bot-ip>:<port>/github/webhook` (must match the `path` config)
    * **Content type**: Select `application/json` (**Crucial for parsing**)
    * **Secret**: Enter the `secret` matching your plugin config.
4.  **Which events would you like to trigger this webhook?**
    * It is recommended to choose **Let me select individual events**, and check:
        * Discussions
        * Issues
        * Pull requests
        * Releases
        * Stars (Watch)
5.  Click **Add webhook**.

## 🛠️ Testing Commands

For easier debugging, the plugin provides simulation commands (usable by default with `authority: 1`):
- `gh .test-issue [repo]`：Simulate an Issue event
- `gh .test-pr [repo]`：Simulate a Pull Request event
- `gh .test-discussion [repo]`：Simulate a Discussion event
- `gh .test-release [repo]`：Simulate a Release event
- `gh .test-star [repo] [count]`：Simulate a Star event

> Example: `gh .test-issue koishi/test-repo`

## 🖼️ Preview

The plugin automatically identifies event types and applies appropriate theme colors. The Markdown engine converts the text into a stunning Fluent design card. When sending the image, a short text prefix is prepended to give users immediate context without having to open the large image!

> [Issue 动态] user/repo #12
> Title: Fixed a critical bug
> [Image: A beautiful Fluent-style long screenshot containing the full Markdown-parsed body]

## 📝 Development & Contribution

Issues and Pull Requests are welcome!

## 📄 License

MIT
