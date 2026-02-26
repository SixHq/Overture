# Overture

**Visual plan execution and approval workflow for AI coding agents.**

![Overture Demo](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjlpamJtaDBucnVsdGJqd3oxdG94OWdhNTYyazh4OWpucTE5YnF5ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/H14MYQfEAliJLvuayW/giphy.gif)

---

## The Problem

Every AI coding agent today — Cursor, Claude Code, Cline, Copilot — works the same way: you type a prompt, the agent starts writing code, and you have no idea what it's actually planning to do.

By the time you realize the agent misunderstood your request, it has already written hundreds of lines of code that need to be discarded.

Some agents show plans as text in chat. But text plans don't show you:
- How steps relate to each other
- Where the plan branches into different approaches
- What context each step needs to succeed

You end up wasting tokens, time, and patience.

---

## The Solution

Overture intercepts your AI agent's planning phase and renders it as an interactive visual flowchart — before any code is written.

![Overture Screenshot](assets/screenshot.png)

With Overture, you can:

- **See the complete plan** as an interactive graph before execution begins
- **Click any node** to view full details about what that step will do
- **Attach context** like files, documents, API keys, and instructions to specific steps
- **Choose between approaches** when the agent proposes multiple ways to solve a problem
- **Watch execution in real-time** as nodes light up with progress, completion, or errors

The agent doesn't write a single line of code until you approve the plan.

---

## Installation

Overture is an MCP server that works with any MCP-compatible AI coding agent.

### Claude Code

Run this command to add Overture to Claude Code:

```bash
claude mcp add overture-mcp -- npx overture-mcp
```

That's it. Claude Code will now use Overture for plan visualization.

### Cursor

Open your Cursor MCP configuration file at `~/.cursor/mcp.json` and add:

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"]
    }
  }
}
```

Restart Cursor for the changes to take effect.

### Cline (VS Code Extension)

Open VS Code settings, search for "Cline MCP", and add this to your MCP servers configuration:

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"]
    }
  }
}
```

### Sixth AI (VS Code Extension)

Open the Sixth AI MCP settings file and add Overture:

**File locations:**
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\sixth.sixth-ai\settings\sixth-mcp-settings.json`
- **Linux:** `~/.config/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json`

Add this to the `mcpServers` object:

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"],
      "disabled": false
    }
  }
}
```

Restart VS Code for the changes to take effect.

### GitHub Copilot

Create a `.vscode/mcp.json` file in your project root:

```json
{
  "servers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"]
    }
  }
}
```

After creating the file, reload VS Code (Cmd/Ctrl + Shift + P → "Developer: Reload Window").

**Note:** GitHub Copilot MCP support requires VS Code 1.99+ and uses a different configuration format (`servers` instead of `mcpServers`).

### Global Installation (Optional)

If you prefer to install Overture globally instead of using npx:

```bash
npm install -g overture-mcp
```

Then replace `npx overture-mcp` with just `overture-mcp` in any of the configurations above.

### Verifying Installation

Once installed, give your agent any task. Overture will automatically open in your browser at `http://localhost:3031` and display the plan for your approval.

---

## How It Works

1. **You prompt your agent** with a task like "Build a REST API with authentication"

2. **The agent generates a detailed plan** broken down into individual steps, with branching paths where multiple approaches are possible

3. **Overture displays the plan** as an interactive graph in your browser

4. **You review and enrich the plan** by clicking nodes to see details, attaching files or API keys to specific steps, and selecting which approach to take at decision points

5. **You approve the plan** and the agent begins execution

6. **You watch progress in real-time** as each node updates with its status — active, completed, or failed

---

## Configuration

You can customize Overture's behavior using environment variables. Here's how to set them for each agent:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERTURE_HTTP_PORT` | `3031` | Port for the web UI |
| `OVERTURE_WS_PORT` | `3030` | Port for WebSocket communication |
| `OVERTURE_AUTO_OPEN` | `true` | Set to `false` to prevent auto-opening browser |

### Setting Environment Variables

**Claude Code**

```bash
claude mcp add overture-mcp -e OVERTURE_HTTP_PORT=4000 -e OVERTURE_AUTO_OPEN=false -- npx overture-mcp
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"],
      "env": {
        "OVERTURE_HTTP_PORT": "4000",
        "OVERTURE_WS_PORT": "4001",
        "OVERTURE_AUTO_OPEN": "false"
      }
    }
  }
}
```

**Cline & Sixth AI**

Add the `env` object to your MCP server configuration:

```json
{
  "mcpServers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"],
      "env": {
        "OVERTURE_HTTP_PORT": "4000",
        "OVERTURE_WS_PORT": "4001",
        "OVERTURE_AUTO_OPEN": "false"
      }
    }
  }
}
```

**GitHub Copilot** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "overture": {
      "command": "npx",
      "args": ["overture-mcp"],
      "env": {
        "OVERTURE_HTTP_PORT": "4000",
        "OVERTURE_WS_PORT": "4001",
        "OVERTURE_AUTO_OPEN": "false"
      }
    }
  }
}
```

**Global Installation (shell)**

If you installed globally, set variables in your shell before running:

```bash
# macOS/Linux
export OVERTURE_HTTP_PORT=4000
export OVERTURE_AUTO_OPEN=false
overture-mcp

# Windows (PowerShell)
$env:OVERTURE_HTTP_PORT="4000"
$env:OVERTURE_AUTO_OPEN="false"
overture-mcp
```

---

## Contributing

Overture is open source and we welcome contributions from the community.

Whether you want to report a bug, suggest a feature, improve documentation, or contribute code — we'd love to have you involved.

- **Report issues** at [github.com/SixHq/Overture/issues](https://github.com/SixHq/Overture/issues)
- **Read the contributing guide** at [CONTRIBUTING.md](https://github.com/SixHq/Overture/blob/main/CONTRIBUTING.md)
- **Join the discussion** in GitHub Discussions

All contributions are appreciated, no matter how small.

---

## License

MIT License - see [LICENSE](https://github.com/SixHq/Overture/blob/main/LICENSE) for details.

---

Built by [Sixth](https://trysixth.com)

For an even better experience, try [Sixth for VS Code](https://marketplace.visualstudio.com/items?itemName=Sixth.sixth-ai) — Overture is built-in with zero configuration required.
