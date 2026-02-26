# Contributing to Overture

First off, thank you for considering contributing to Overture! It's people like you that make Overture such a great tool for the developer community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [support@trysixth.com](mailto:support@trysixth.com).

## Getting Started

Overture is a monorepo containing two main packages:

- **`packages/mcp-server`** — The MCP server that communicates with AI agents
- **`packages/ui`** — The React-based visual canvas interface

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

## Development Setup

1. **Fork the repository**

   Click the "Fork" button at the top right of the [Overture repository](https://github.com/SixHq/Overture).

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Overture.git
   cd Overture
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development servers**

   In one terminal, start the UI dev server:
   ```bash
   cd packages/ui
   npm run dev
   ```

   In another terminal, start the MCP server:
   ```bash
   cd packages/mcp-server
   npm run dev
   ```

5. **Open the UI**

   Navigate to `http://localhost:5173` in your browser.

## Project Structure

```
overture/
├── packages/
│   ├── mcp-server/          # MCP server package
│   │   ├── src/
│   │   │   ├── index.ts     # MCP server entry point
│   │   │   ├── cli.ts       # CLI entry point
│   │   │   ├── tools/       # MCP tool handlers
│   │   │   ├── websocket/   # WebSocket server
│   │   │   ├── store/       # Plan state management
│   │   │   └── types.ts     # TypeScript types
│   │   ├── prompts/         # Agent instruction files
│   │   └── ui-dist/         # Built UI (copied from ui/dist)
│   │
│   └── ui/                  # React UI package
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── stores/      # Zustand stores
│       │   ├── hooks/       # Custom React hooks
│       │   └── utils/       # Utility functions
│       └── public/          # Static assets
│
├── prompts/                 # Agent-specific documentation
├── assets/                  # Images, logos, etc.
└── docs/                    # Additional documentation
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:
- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, agent used)

### Suggesting Features

We love feature suggestions! When suggesting a feature:
- **Check existing issues** to avoid duplicates
- **Describe the problem** you're trying to solve
- **Describe your proposed solution**
- **Consider alternatives** you've thought about

### Contributing Code

1. **Find an issue** to work on, or create one first
2. **Comment on the issue** to let others know you're working on it
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Make your changes** following our style guidelines
5. **Test your changes** thoroughly
6. **Commit your changes** with a clear message
7. **Push to your fork** and create a Pull Request

### Good First Issues

Looking for a place to start? Check out issues labeled [`good first issue`](https://github.com/SixHq/Overture/labels/good%20first%20issue) — these are specifically curated for new contributors.

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features when applicable
3. **Ensure all tests pass** before submitting
4. **Fill out the PR template** completely
5. **Request a review** from maintainers
6. **Address feedback** promptly and respectfully

### PR Title Convention

Use conventional commit format for PR titles:

- `feat: add parallel execution support`
- `fix: resolve node status not updating`
- `docs: update installation instructions`
- `refactor: simplify WebSocket message handling`
- `style: improve canvas animations`
- `chore: update dependencies`

### Review Process

- PRs require at least one approval from a maintainer
- We aim to review PRs within 48 hours
- Be patient — maintainers are often volunteers with other commitments

## Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer `interface` over `type` for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### React (UI Package)

- Use functional components with hooks
- Prefer Zustand for state management
- Use Tailwind CSS for styling
- Keep components small and focused
- Co-locate related files

### Code Formatting

We use ESLint and Prettier. Before committing:

```bash
npm run lint
```

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters
- Reference issues when applicable (`Fixes #123`)

## Community

### Getting Help

- **GitHub Discussions** — For questions and general discussion
- **GitHub Issues** — For bugs and feature requests
- **Discord** — Coming soon!

### Recognition

Contributors are recognized in several ways:
- Listed in our [Contributors](https://github.com/SixHq/Overture/graphs/contributors) page
- Mentioned in release notes for significant contributions
- Special recognition for consistent contributors

---

## Thank You!

Your contributions make Overture better for everyone. Whether it's fixing a typo, reporting a bug, or building a major feature — every contribution matters.

**Happy coding!** 🎉
