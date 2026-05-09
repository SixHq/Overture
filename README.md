<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/SixHq/Overture/main/assets/overture-logo-dark.png">
    <img src="https://raw.githubusercontent.com/SixHq/Overture/main/assets/overture-logo-light.png" alt="Overture" width="400">
  </picture>
</p>

<p align="center">
  <strong>See the plan before the code. Approve it. Then watch it execute.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overture-mcp"><img src="https://img.shields.io/npm/v/overture-mcp?style=for-the-badge&color=blue" alt="npm version"></a>
  <a href="https://github.com/SixHq/Overture/actions"><img src="https://img.shields.io/github/actions/workflow/status/SixHq/Overture/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/overture-mcp"><img src="https://img.shields.io/npm/dm/overture-mcp?style=for-the-badge&color=orange" alt="npm downloads"></a>
  <a href="https://github.com/SixHq/Overture/discussions"><img src="https://img.shields.io/github/discussions/SixHq/Overture?style=for-the-badge&color=purple" alt="Discussions"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#-the-problem">Problem</a> •
  <a href="#-the-solution">Solution</a> •
  <a href="#-installation">Install</a> •
  <a href="#-features">Features</a> •
  <a href="#-mcp-marketplace">Marketplace</a> •
  <a href="#-configuration">Config</a> •
  <a href="#-faq">FAQ</a> •
  <a href="https://github.com/SixHq/Overture/discussions">Discussions</a>
</p>

<br>

<p align="center">

https://github.com/user-attachments/assets/eeb9c4cb-c80d-42da-bf63-c0c4ecb1e5d6

</p>

---

## 🔥 The Problem

Every AI coding agent today — **Cursor**, **Claude Code**, **Cline**, **Copilot** — works the same way:

<table>
<tr>
<td width="50%">

### What Happens Now

1. You type a prompt
2. Agent **immediately starts writing code**
3. You have **zero visibility** into what it's doing
4. You realize it misunderstood your request
5. **Hundreds of lines of code** need to be discarded
6. You've wasted tokens, time, and patience

</td>
<td width="50%">

### Text Plans Don't Help

Some agents show plans as text in chat. But text fails to show:

- **Dependencies** — which tasks depend on what?
- **Branch points** — what alternative approaches exist?
- **Context requirements** — which files, APIs, or secrets are needed?
- **Complexity** — which steps are risky?
- **Progress** — what's done, what's next?

</td>
</tr>
</table>

<p align="center">
  <img src="https://raw.githubusercontent.com/SixHq/Overture/main/assets/problem-illustration.png" alt="The Problem" width="700">
</p>

---

## ✨ The Solution

Overture changes this with a **visual plan-first workflow**:

1. **Plan** — Overture generates a visual execution plan as a flowchart
2. **Approve** — You review, modify, and approve the plan before any code is written
3. **Execute** — Watch each step execute in real-time, with full visibility

### Why Visual Plans?

| Text Plans | Visual Plans (Overture) |
|------------|-------------------------|
| ❌ Linear only | ✅ Shows dependencies and branch points |
| ❌ No progress tracking | ✅ Real-time step execution status |
| ❌ No context visibility | ✅ Files, APIs, secrets clearly marked |
| ❌ No complexity indication | ✅ Node size/color shows risk level |
| ❌ Hard to modify | ✅ Drag nodes, add/delete steps |

---

## 📦 Installation

### Via MCP Marketplace (Recommended)

The easiest way to get started is through the built-in MCP marketplace in your AI coding tool:

1. Open your AI coding tool (Cursor, Claude Code, VS Code with Sixth, etc.)
2. Navigate to MCP settings/extensions
3. Find **Overture** in the marketplace
4. Click **Install**

### Manual Installation

```bash
npm install -g overture-mcp
```

Or add to your MCP config:

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["-y", "overture-mcp"]
    }
  }
}
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Visual Plan Generation** | Automatically generates flowchart plans from prompts |
| **Plan Approval** | Review and modify plans before execution |
| **Real-time Execution** | Watch each step execute with progress tracking |
| **Dependency Tracking** | See which tasks depend on each other |
| **MCP Marketplace** | One-click install in your AI coding tool |
| **Multi-Agent Support** | Coordinate multiple agents in one plan |

---

## 🛒 MCP Marketplace

Overture is available in the MCP marketplace for easy integration:

- **Cursor** — Settings → MCP → Marketplace → Overture
- **Claude Code** — MCP config → Marketplace → Overture
- **VS Code with Sixth** — Built-in, zero configuration

---

## ⚙️ Configuration

### Basic MCP Config

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["-y", "overture-mcp"],
      "env": {
        "OVERTURE_PORT": "3000"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERTURE_PORT` | `3000` | Port for UI dashboard |
| `OVERTURE_LOG_LEVEL` | `info` | Logging level |

---

## ❓ FAQ

### What is Overture?
Overture is a **visual plan-first workflow system** for AI coding agents. It generates execution plans as visual flowcharts, lets you approve them, and then executes each step with real-time visibility.

### How does Overture differ from other AI coding tools?
**Traditional approach:** Agents immediately start writing code with zero visibility.
**Overture approach:** Plan → Approve → Execute. You see the visual plan, modify it if needed, and watch execution in real-time.

### Which AI coding tools does Overture support?
- **Cursor** — MCP marketplace integration
- **Claude Code** — MCP config integration
- **VS Code with Sixth** — Built-in (zero config)
- **Cline/Copilot** — MCP marketplace (coming soon)

### How do I install Overture?
**Recommended:** Use MCP marketplace in your AI coding tool (one-click install).
**Manual:** `npm install -g overture-mcp` or add to MCP config.

### What does the visual plan show?
- **Nodes** — Each step in the execution plan
- **Edges** — Dependencies between steps
- **Colors** — Status (pending, running, done, failed)
- **Sizes** — Complexity/risk level
- **Labels** — Files, APIs, context requirements

### Can I modify the plan before execution?
Yes! You can:
- Drag nodes to reorder
- Add/delete steps
- Edit step details
- Mark steps as optional

### What is the MCP marketplace?
MCP (Model Context Protocol) marketplace lets you install tools like Overture with one click in your AI coding tool. No manual config required.

### Is Overture open source?
Yes! MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.

### Where can I get help?
- [GitHub Discussions](https://github.com/SixHq/Overture/discussions) for questions
- [GitHub Issues](https://github.com/SixHq/Overture/issues) for bugs
- Try [Sixth for VS Code](https://marketplace.visualstudio.com/items?itemName=Sixth.sixth-ai) for built-in support

---

## 🔧 Development

### Local Development

```bash
# Clone the repo
git clone https://github.com/SixHq/Overture.git

# Install dependencies
npm install

# Build all packages
npm run build

# Run MCP server
npm run dev

# Start UI dev server (in another terminal)
cd packages/ui && npm run dev
```

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| **MCP Server** | Node.js, TypeScript, Express, WebSocket (ws), SAX XML Parser |
| **UI** | React 18, React Flow, Zustand, Framer Motion, Tailwind CSS, Vite |
| **Layout** | Dagre (automatic graph positioning) |

---

## 🤝 Contributing

Overture is open source and we welcome contributions!

- 🐛 **Report bugs** at [GitHub Issues](https://github.com/SixHq/Overture/issues)
- 💡 **Suggest features** at [GitHub Discussions](https://github.com/SixHq/Overture/discussions)
- 📖 **Improve docs** — PRs welcome
- 🔧 **Contribute code** — see [CONTRIBUTING.md](CONTRIBUTING.md)

All contributions are appreciated, no matter how small.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <br>
  <img src="https://raw.githubusercontent.com/SixHq/Overture/main/assets/sixth-logo.png" alt="Sixth" width="120">
  <br><br>
  Built by <a href="https://trysixth.com"><strong>Sixth</strong></a>
  <br><br>
  For the best experience, try <a href="https://marketplace.visualstudio.com/items?itemName=Sixth.sixth-ai"><strong>Sixth for VS Code</strong></a><br>
  Overture is built-in with zero configuration required.
  <br><br>
  <sub>Stop flying blind. See the plan. Approve it. Execute with confidence.</sub>
</p>


## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SixHq/Overture&type=date&legend=top-left)](https://www.star-history.com/#SixHq/Overture&type=date&legend=top-left)
