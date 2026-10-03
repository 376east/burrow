# Burrow

A desktop Minecraft launcher for solo play, local packs and playing with friends. Current development is **Burrow Next**, with play, library, together and settings. Stable code remains in `main`; current product and docs are in [`rebuild/burrow-next`](https://github.com/malyarq/burrow/tree/rebuild/burrow-next).

[Next README](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/README.en.md) · [Review plan, Russian](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/PLAN.md) · [Agent guide, Russian](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/docs/AGENT_GUIDE.md) · [45-second narrated demo](https://raw.githubusercontent.com/malyarq/burrow/rebuild/burrow-next/docs/assets/demo/burrow-next-demo.mp4) · [Русский](README.md)

React UI sends typed IPC requests through preload. Electron main validates requests, performs filesystem/provider operations and returns state. [Architecture](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/docs/en/architecture.md). No runtime LLM feature is implemented; illustration and narration are production tools, documented in the [plan](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/PLAN.md).

```bash
git clone https://github.com/malyarq/burrow.git
cd burrow
git switch rebuild/burrow-next
npm ci
npm run dev
```

Use Node.js 24.x and npm 11.x. Ordinary use needs no API keys. [Commands and environment](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/docs/AGENT_GUIDE.md).

Next has local Windows checks; macOS/Linux and a complete game path require separate verification. Microsoft login is unavailable. Production audit still fails through XMCL: [plan](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/PLAN.md). Demo packs are synthetic; Minecraft is not launched.

[GitHub Releases](https://github.com/malyarq/burrow/releases/latest) contains stable-line packages. [Stable docs](docs/README.md), [demo reproduction](https://github.com/malyarq/burrow/blob/rebuild/burrow-next/docs/DEMO.md), [collaboration rules](AGENTS.md).

Existing [MIT license](LICENSE); third-party terms remain applicable: [notices](THIRD_PARTY_NOTICES.md). Burrow is not affiliated with Mojang or Microsoft.
