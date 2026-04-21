# ai-debugger

Runtime debugging toolkit for web apps — inject state tracking, function interception, expression polling, and timeline instrumentation into any page via browser automation.

**Zero dependencies. No setup. Works with any AI coding agent that has browser automation.**

## What it does

`ai-debugger` gives your AI coding agent a debugging toolkit it can inject into any running web page. Once injected, the agent can:

- **Track state** — watch JavaScript values with full change history
- **Intercept functions** — monkey-patch `fetch`, `localStorage.setItem`, or any function to record every call
- **Poll expressions** — periodically evaluate expressions and track changes over time
- **Annotate timeline** — mark key moments and correlate them with state changes
- **Snapshot everything** — get a full dump of all tracked data in one call

All of this happens at runtime via browser automation — no code changes required (though code instrumentation mode is also supported for tracking internal state).

## Install

### GitHub Copilot CLI

```bash
copilot plugin install AbdouMoumen/ai-debugger
```

### Claude Code

**Interactive (within a Claude session):**

1. Run `/plugin`
2. Select **Marketplaces** → **Add marketplace**
3. Enter `AbdouMoumen/ai-debugger`
4. Install the plugin from the marketplace

**Command line:**

```bash
claude plugin marketplace add AbdouMoumen/ai-debugger
claude plugin install ai-debugger@ai-debugger
```

### Any other agent

Copy the skill files into your agent's instruction directory, or just tell your agent to read the `SKILL.md` file:

```
skills/ai-debugger/SKILL.md                   # Skill definition
skills/ai-debugger/reference/debug-agent.js   # Injectable script
skills/ai-debugger/reference/api-reference.md # Full API docs
```

## Prerequisites

Your AI agent needs a browser automation tool that can:

1. **Navigate** to a URL
2. **Evaluate JavaScript** in the page context

Any tool works — Playwright MCP, Chrome DevTools MCP, Puppeteer MCP, built-in browser tools, etc.

## How it works

```
┌─────────────────────────────┐
│       AI Coding Agent       │
│  (Claude, Copilot, etc.)    │
└──────────┬──────────────────┘
           │
           │  1. Read debug-agent.js
           │  2. Evaluate in page
           │  3. Call __debugAgent APIs
           │
           ▼
┌─────────────────────────────┐
│    Browser Automation       │
│  (Playwright, DevTools...)  │
└──────────┬──────────────────┘
           │
           │  browser_evaluate()
           │
           ▼
┌─────────────────────────────┐
│     Web Page (any URL)      │
│                             │
│  window.__debugAgent = {    │
│    watch, intercept, poll,  │
│    mark, getTimeline,       │
│    getSnapshot, ...         │
│  }                          │
└─────────────────────────────┘
```

## Quick example

Once the agent injects the script, it can do things like:

```javascript
// Track all fetch calls
__debugAgent.intercept('fetch')

// Watch for error banners
__debugAgent.poll('errors', "document.querySelectorAll('[role=alert]').length")

// Mark a moment
__debugAgent.mark('clicked-submit')

// Get everything that happened
__debugAgent.getTimeline({ last: 20 })

// Full state dump
__debugAgent.getSnapshot()
```

## API overview

| Method | Description |
|--------|-------------|
| `watch(key, value, opts?)` | Track a value with history |
| `get(key)` | Read entry with full history |
| `getAll()` | All tracked entries |
| `intercept(path, opts?)` | Monkey-patch function at dot-path |
| `restore(path)` | Undo interception |
| `getInterceptions()` | List interceptions + call logs |
| `poll(key, expr, opts?)` | Periodically evaluate expression |
| `stopPoll(key)` | Stop polling |
| `getPolls()` | List polls + change history |
| `mark(label, data?)` | Add timestamped annotation |
| `getTimeline(opts?)` | Get chronological events (filterable) |
| `getSnapshot()` | Full dump of everything |

See [api-reference.md](skills/ai-debugger/reference/api-reference.md) for complete documentation.

## Plugin structure

```
ai-debugger/
├── plugin.json                          # Copilot CLI manifest
├── .claude-plugin/
│   └── plugin.json                      # Claude Code manifest (same content)
├── skills/
│   └── ai-debugger/
│       ├── SKILL.md                     # Skill definition
│       └── reference/
│           ├── debug-agent.js           # Injectable script (413 lines, zero deps)
│           └── api-reference.md         # Full API documentation
└── README.md
```

## License

MIT
