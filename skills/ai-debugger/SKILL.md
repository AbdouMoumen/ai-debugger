---
name: ai-debugger
description: Debug and validate any running web app using browser automation with an injectable runtime instrumentation toolkit. Use when asked to debug web apps at runtime, investigate any web page, intercept function calls, poll expressions, track state changes, or do live debugging.
allowed-tools: playwright-*, powershell, view, grep, glob, edit, create
argument-hint: <url> [description]
---

# AI Debugger

Debug and validate **any running web app** by injecting a lightweight runtime instrumentation toolkit (`debug-agent.js`) via browser automation. Works with any URL, any browser automation MCP server — no app-specific setup required.

Use your judgment to investigate the problem — these are the tools at your disposal, not a checklist.

## Reference

- [API Reference — all methods, recipes, and workflows](reference/api-reference.md)
- [debug-agent.js — the injectable script](reference/debug-agent.js)

---

## Prerequisites

This skill requires a browser automation tool that can:

1. **Navigate** to a URL
2. **Evaluate JavaScript** in the page context and return results

Any MCP server or built-in tool with these two capabilities works. Examples include Playwright MCP, Chrome DevTools MCP, Puppeteer MCP, and others. The examples below use Playwright MCP syntax — adapt the tool names to whatever browser automation you have available.

---

## Two Instrumentation Modes

### Mode 1: Runtime Instrumentation (no code changes)

Inject the script, then call `__debugAgent` APIs via your JS evaluation tool. Use for intercepting functions, polling expressions, and tracking globals — all without touching source code.

### Mode 2: Code Instrumentation (edit source files)

Add `window.__debugAgent?.watch(key, value)` calls to source files. Uses optional chaining — no-op if script isn't injected. Use when you need to track internal state, React props/state, or values not accessible from globals.

**Both modes feed into the same stores and timeline.**

---

## Getting Started

### Workflow: Runtime Mode

**1. Navigate** to the target URL using your browser automation's navigate tool.

```
# Example (Playwright MCP):
browser_navigate({ url: "<target-url>" })
```

**2. Inject** the debug agent — read the script file, then evaluate it in the page:

```
view('reference/debug-agent.js')   # Read the script content
```

Then evaluate the script content in the page using your JS evaluation tool:

```
# Example (Playwright MCP):
browser_evaluate({ function: "<script content>" })
```

**3. Verify** injection succeeded:

```
# Example (Playwright MCP):
browser_evaluate({ function: "() => window.__debugAgent?.isInjected === true" })
```

**4. Instrument** — set up watchers, interceptions, polls via JS evaluation:

```javascript
// Intercept fetch calls
() => __debugAgent.intercept('fetch')

// Poll for error elements
() => __debugAgent.poll('errors', "document.querySelectorAll('[role=alert]').length")
```

**5. Interact** with the page (click, type, navigate) using your browser automation tools, or wait for user actions.

**6. Read results** via JS evaluation:

```javascript
() => __debugAgent.getTimeline({ last: 20 })
() => __debugAgent.getSnapshot()
```

**7. Report** findings.

### Workflow: Code Instrumentation Mode

**1-3.** Same as runtime mode (navigate, inject, verify).

**4. Edit source files** to add `window.__debugAgent?.watch()` calls at strategic points:

```typescript
// Add to a React component:
window.__debugAgent?.watch('UserProfile.userId', userId, { context: 'prop received' });

// Add to a service function:
window.__debugAgent?.watch('api.fetchUsers', 'loading', { context: 'Starting fetch' });
```

**5. Rebuild** the app (or wait for HMR to pick up changes).

**6. Interact and read** — same as runtime mode.

**7. Clean up** — remove all `window.__debugAgent?.` calls from source files:

```bash
git diff --name-only | xargs grep -l "__debugAgent"
```

**8. Report** findings.

### SPA Persistence

For single-page apps where navigation reloads the page, inject the script using a method that persists across navigations. Some tools support this natively:

```
# Example (Playwright MCP — addInitScript persists across navigations):
browser_run_code({ code: "async (page) => { await page.addInitScript(<script-content>); }" })
```

If your browser automation tool doesn't support persistent scripts, re-inject after each navigation.

---

## Key APIs

### State Tracking

```javascript
__debugAgent.watch(key, value, opts?)    // Track a value with history
__debugAgent.get(key)                    // Read entry with full history
__debugAgent.getAll()                    // Read all entries
__debugAgent.getKeys()                   // List tracked keys
__debugAgent.unwatch(key)                // Remove an entry
__debugAgent.clear()                     // Clear all
```

### Function Interception (runtime only)

```javascript
__debugAgent.intercept('fetch')                              // Wrap fetch to record all calls
__debugAgent.intercept('localStorage.setItem')               // Track storage writes
__debugAgent.intercept('history.pushState')                  // Track SPA navigation
__debugAgent.intercept('myApp.api.getUser', { errorsOnly: true })  // Only record errors
__debugAgent.restore('fetch')                                // Undo interception
__debugAgent.getInterceptions()                              // List all with call logs
```

### Expression Polling (runtime only)

```javascript
__debugAgent.poll('rowCount', "document.querySelectorAll('.row').length")
__debugAgent.poll('authState', "window.__store__?.getState()?.auth?.status", { intervalMs: 500 })
__debugAgent.stopPoll('rowCount')
__debugAgent.getPolls()
```

### Timeline & Markers

```javascript
__debugAgent.mark('clicked-submit')                          // Add annotation
__debugAgent.getTimeline()                                   // All events
__debugAgent.getTimeline({ types: ['intercept'], last: 10 }) // Filtered
```

### Snapshot

```javascript
__debugAgent.getSnapshot()    // Everything: watches + interceptions + polls + timeline + stats
```

See [api-reference.md](reference/api-reference.md) for full details, options, and recipes.

---

## Complementary Browser Tools

Use your browser automation's built-in tools alongside `__debugAgent` — they handle things the script doesn't need to duplicate:

| Need | What to use |
|---|---|
| Console messages | Your browser tool's console/log retrieval |
| Network requests | Your browser tool's network request log |
| Screenshots | Your browser tool's screenshot capability |
| DOM / accessibility tree | Your browser tool's page snapshot or DOM inspection |
| Page interaction | Your browser tool's click, type, keyboard tools |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `__debugAgent` undefined | Script not injected yet — run the injection step |
| Script lost after navigation | Use persistent injection (e.g., `addInitScript`) or re-inject after each navigation |
| `intercept()` returns null | Path doesn't resolve to a function — check the dot-path |
| `poll()` errors | Expression syntax error — test it manually via JS evaluation first |
| Auth required | Navigate to the page, ask user to log in manually |
| Values show `undefined` | The expression may run before the app initializes — add a delay or poll |
| Large snapshot | Filter with `getTimeline({ last: N })` or query specific keys with `get(key)` |

---

## Report Template

When reporting findings, include what's relevant:

```
APP: <app name or URL>
URL: <tested URL>
STATUS: PASS | FAIL | NEEDS_INVESTIGATION

INSTRUMENTATION:
- Interceptions: <list of intercepted functions>
- Polls: <list of polled expressions>
- Watchers: <list of tracked keys>

FINDINGS:
- <what was observed>

TIMELINE (key events):
- <timestamp>: <event>

EVIDENCE:
- <screenshots, snapshots, etc.>
```
