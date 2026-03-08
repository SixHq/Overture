# GROWTH.md — Overture Community Growth Playbook

> *This document was contributed by the community to help Overture reach the developers who need it.*

---

## 1. Positioning & Core Narrative

### What Overture Is

Overture is **the missing transparency layer for AI coding agents**. It intercepts AI planning and renders it as an interactive visual flowchart before any code is written — giving developers control, visibility, and the ability to course-correct *before* wasting tokens.

### Why It Matters

Every AI coding tool today (Cursor, Claude Code, Cline, Copilot) has the same blind spot: you type a prompt, and the agent immediately starts coding. No visibility. No approval gate. If it misunderstands, you've wasted time, tokens, and patience.

Overture fixes this with a single principle: **See the plan. Approve it. Then watch it execute.**

### Core Differentiators

| Feature | Overture | Text-Based Plans | No Plan |
|---------|----------|------------------|---------|
| Visual dependencies | ✅ | ❌ | ❌ |
| Branch comparison | ✅ | ❌ | ❌ |
| Real-time execution tracking | ✅ | ❌ | ❌ |
| Per-step context/files | ✅ | ❌ | ❌ |
| Works with any MCP agent | ✅ | Varies | N/A |
| Token waste prevention | ✅ | Partial | ❌ |

### Target Users

1. **Primary**: Developers using AI coding tools (Cursor, Claude Code, Cline, Copilot) who want more control
2. **Secondary**: AI coding agent builders looking for UX patterns
3. **Tertiary**: Teams evaluating AI coding adoption who need audibility

---

## 2. Visibility Checklist — Awesome Lists & Directories

These are high-impact directories where Overture is not yet listed:

### MCP Ecosystem (Highest Priority)

| List | Stars | Status | Submission Template |
|------|-------|--------|---------------------|
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 82k+ | ❌ Not listed | Add to `README.md` under "Development Tools" or create new "Planning & Visualization" category |
| [yzfly/Awesome-MCP-ZH](https://github.com/yzfly/Awesome-MCP-ZH) | 6.4k | ❌ Not listed | Add Chinese description: "可视化 AI 编码执行计划" |
| [appcypher/awesome-mcp-servers](https://github.com/appcypher/awesome-mcp-servers) | 5.2k | ❌ Not listed | Check contribution guidelines |
| [wong2/awesome-mcp-servers](https://github.com/wong2/awesome-mcp-servers) | 3.7k | ❌ Not listed | Add to relevant category |

**PR Template for MCP lists:**
```markdown
- [Overture](https://github.com/SixHq/Overture) - Visual execution planner for AI coding agents. See plans as interactive flowcharts before code is written. Works with Claude Code, Cursor, Cline, and Copilot.
```

### AI Coding & Developer Tools

| List | Stars | Category Suggestion |
|------|-------|---------------------|
| [ai-for-developers/awesome-ai-coding-tools](https://github.com/ai-for-developers/awesome-ai-coding-tools) | 1.5k | "Planning & Visualization" |
| [wsxiaoys/awesome-ai-coding](https://github.com/wsxiaoys/awesome-ai-coding) | 765 | "Developer Experience" |
| [ai-for-developers/awesome-vibe-coding](https://github.com/ai-for-developers/awesome-vibe-coding) | 604 | "Workflow Tools" |

### General Directories

| Platform | Status | Action |
|----------|--------|--------|
| Product Hunt | ⏳ | Consider a launch when hitting 1k stars |
| MCP.so | ❌ | Submit to MCP server directory |
| VS Code Marketplace (Related Tools) | ⏳ | Feature in Sixth AI extension listing |

---

## 3. Community Engagement — Content Ideas

### Technical Content (Developer Audience)

| Type | Topic Idea | Channel |
|------|------------|---------|
| Tutorial | "How to customize Overture plan schemas for your workflow" | Dev.to, Hashnode |
| Comparison | "Visual vs text plans: A token cost analysis" | Blog, Reddit |
| Deep-dive | "Building approval gates for enterprise AI coding" | Medium, LinkedIn |
| Integration | "Using Overture with [popular MCP servers]" | GitHub Wiki |

### Social Content (Twitter/X)

**Demo-style threads work best for dev tools:**

1. Show the problem (30 sec: agent making mistakes)
2. Show the solution (60 sec: approving visual plan)
3. Show the result (30 sec: clean execution)
4. Drop the link

**Hashtags that index well:**
`#AIcoding` `#DeveloperTools` `#MCP` `#CursorAI` `#ClaudeCode` `#DevEx`

### Reddit Communities

| Subreddit | Approach |
|-----------|----------|
| r/ClaudeAI | Share as "useful MCP server I found" |
| r/cursor | Integration guide for Cursor users |
| r/vscode | Cline/Copilot integration |
| r/LocalLLaMA | For self-hosted LLM users |
| r/programming | Technical deep-dive post |

**Reddit etiquette**: Be a community member first. Answer questions, share insights, then occasionally share relevant tools.

---

## 4. Sustainable Rhythm

### Weekly

- [ ] Monitor GitHub Discussions — respond within 24h
- [ ] Share 1 tip/insight on Twitter (not just promo)
- [ ] Check for new AI coding agent releases that could integrate

### Monthly

- [ ] Submit to 1-2 new awesome lists
- [ ] Publish 1 tutorial or comparison post
- [ ] Review open issues — close stale ones, label actionable ones
- [ ] Update changelog/releases

### Quarterly

- [ ] Create a "What's New in Overture" release post
- [ ] Review analytics: which integrations are most used?
- [ ] Community spotlight: feature contributors or interesting use cases

---

## 5. Contributor Community Building

### Making It Easy to Contribute

- [ ] Add `good first issue` labels to beginner-friendly issues
- [ ] Create `CONTRIBUTING.md` with clear dev setup instructions
- [ ] Add a "Help Wanted" section to README for specific features
- [ ] Acknowledge contributors in release notes

### Engagement Ideas

- Feature community-built MCP server integrations
- Highlight creative use cases in README/Wiki
- Consider a Discord/Slack for real-time community chat

---

## 6. Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| GitHub Stars | GitHub | Track week-over-week growth |
| npm Downloads | npm stats | Weekly active usage |
| Issues/PRs | GitHub | Engagement & contribution rate |
| Twitter mentions | Search/Mention tracking | Organic discussions |
| Traffic sources | GitHub Insights | Which channels drive traffic |

---

## 7. Additional Resources

For more comprehensive launch and growth strategies:

- [Gingiris Open Source Launch Playbook](https://github.com/GingirisApp/gingiris-launch) — battle-tested open source marketing
- [Gingiris B2B Growth Guide](https://github.com/GingirisApp/gingiris-b2b-growth) — PLG strategies for dev tools

---

*This GROWTH.md is a community contribution. Feel free to modify, expand, or adapt it to your needs. PRs welcome!*

*Last updated: March 2026*
