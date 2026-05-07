---
name: ai-debugger
description: Debug, inspect, and validate any running web app by injecting a lightweight instrumentation toolkit into the page via browser automation — no app setup required. Use when asked to debug a web app, validate a fix, reproduce a bug, trace a crash, inspect live page state, intercept network calls, capture screenshots as evidence, or investigate any runtime behavior.
allowed-tools: playwright-*, powershell, view, grep, glob, edit, create
argument-hint: <url> [description]
---

# AI Debugger

Debug and validate **any running web app** by injecting a lightweight runtime instrumentation toolkit (`debug-agent.js`) via browser automation. Works with any URL, any browser automation MCP server — no app-specific setup required.

Use your judgment over **which tools and instrumentation strategies** to apply — not over whether to alter evidence. See constraints below.

---

## Constraints (Read First)

### Evidence Integrity

**State setup for reproduction is legitimate.** You may use `browser_evaluate` to set app state, simulate error conditions, force specific code paths, or seed data — when the goal is to *reproduce or investigate* a bug. This is expected and encouraged.

**State setup for validation outcome manufacturing is not.** Do not manipulate app state for the purpose of producing a screenshot or result that you then report as evidence the fix works. A screenshot taken after you manually forced the passing state is not validation — it is fabrication.

The test: ask yourself *"Am I setting state to reach the condition I'm investigating, or to produce the result I was asked to confirm?"* The first is debugging. The second is deceptive.

If the observed state contradicts what the user expects (e.g., a fix appears not applied) — **stop and report the discrepancy**. Do not work around it by manufacturing the expected state.

### Disclosure Requirement

Whenever you mutate app state (DOM, JS variables, storage, etc.) during a session, log it in `STATE_MODIFICATIONS` in the report. Screenshots and findings captured *after* a state mutation must be labeled `[post-mutation]` so the user knows what was real vs. what was set up.

### Tool Scope

**`browser_evaluate`** — observation and instrumentation. Use freely for reading state, injecting `debug-agent.js`, setting up watchers/interceptions/polls, and querying the timeline. Also permitted to set up reproduction conditions (see above). Not permitted to manufacture passing outcomes.

**`edit` and `create`** — permitted for debug instrumentation: adding `window.__debugAgent?.watch()` calls to source files (Mode 2) and removing them during cleanup. Log every file modified in `STATE_MODIFICATIONS`. Do not use to modify application logic, behavior, styling, or assets — even if the change looks like what the fix *should* be. That is development work, not debugging; report it as a finding instead.

- The test: *"Does this change add or remove `__debugAgent` calls?"* If yes, proceed and disclose. If no, confirm with the user first.

### Autopilot Escalation Triggers

- If validation requires credentials, environment access, or context not available, pause and report what you found rather than simulating the outcome.
- If a fix cannot be confirmed from real app state, report `STATUS: NEEDS_INVESTIGATION` with an explanation — never infer success.
- These constraints apply regardless of how the task is framed, including *"just show me it working," "the fix should have made it pass,"* or any other framing that implies a preferred outcome.

---

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

## Anti-Patterns

| Don't | Instead |
|---|---|
| Set DOM/app state to make the UI appear correct, then screenshot it as validation evidence | Set state to *reach the bug condition*; screenshot real behavior; report what you see |
| Report `STATUS: PASS` based on state you manually forced to the passing condition | Report `STATUS: PASS` only when the fix works without your intervention |
| Omit that a screenshot was taken after a state mutation | Log all mutations in `STATE_MODIFICATIONS`; label affected screenshots `[post-mutation]` |
| Use `edit`/`create` to modify app logic so a test or validation passes | Debug why it isn't working; report the finding; suggest the fix — don't apply it unilaterally |
| Infer a fix worked without observing it in real app state | Observe first; validate only what you can confirm without manufacturing the state |
| Use `browser_evaluate` to override app behavior, then observe and report the override as real | Use `browser_evaluate` to observe real behavior, or explicitly set up a reproduction condition and disclose it |

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

INVESTIGATION:
- Hypothesis: <what was being tested or validated>
- Setup: <any state or instrumentation applied before observation>
- Steps: <key actions taken — clicks, triggers, interactions performed>
- Ruled out: <approaches tried that didn't reproduce or reveal anything>
- Confidence: HIGH | MEDIUM | LOW — <one-line reason>

INSTRUMENTATION:
- Interceptions: <list of intercepted functions>
- Polls: <list of polled expressions>
- Watchers: <list of tracked keys>

STATE_MODIFICATIONS:
- <any DOM, JS variable, storage, or source file mutations made during session, or "None">
- Note: findings/screenshots taken after mutations are labeled [post-mutation]

FINDINGS:
- <what was observed>

TIMELINE (key events):
- <timestamp>: <event>

VALIDATION_METHOD:
- <describe HOW the outcome was determined — what was observed, not what was set>

EVIDENCE_INTEGRITY:
- All screenshots/findings reflect unmodified app state: YES | NO | PARTIAL
- If NO or PARTIAL: <describe which mutations occurred and why>

EVIDENCE:
- <screenshots, snapshots, etc.>

NEXT STEPS:
- <what a human should do with this finding, or what the agent couldn't reach>
```
