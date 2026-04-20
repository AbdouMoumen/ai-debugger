# Debug Agent API Reference

Quick reference for the `window.__debugAgent` injectable runtime instrumentation toolkit.

## Injection

```javascript
// 1. Read the script file
// view('reference/debug-agent.js')

// 2. Inject via your browser automation's JS evaluation tool
// Example (Playwright MCP): browser_evaluate({ function: "<contents of debug-agent.js>" })
// Example (Chrome DevTools MCP): evaluate_script({ script: "<contents>" })

// 3. Verify
// Evaluate: () => window.__debugAgent?.isInjected === true
```

For SPA persistence across navigations, use a mechanism that re-injects after each page load (e.g., Playwright's `addInitScript`, or re-evaluate after navigation).

---

## API Quick Reference

| Method | Subsystem | Description |
|---|---|---|
| `watch(key, value, opts?)` | State Tracking | Track/update a value with history |
| `unwatch(key)` | State Tracking | Stop tracking a key |
| `get(key)` | State Tracking | Get one entry with full history |
| `getAll()` | State Tracking | Get all tracked entries |
| `getKeys()` | State Tracking | List tracked key names |
| `clear()` | State Tracking | Clear all tracked data |
| `intercept(path, opts?)` | Interception | Monkey-patch function at dot-path |
| `restore(path)` | Interception | Undo interception, restore original |
| `getInterceptions()` | Interception | List active interceptions + call logs |
| `poll(key, expr, opts?)` | Polling | Periodically evaluate expression, track changes |
| `stopPoll(key)` | Polling | Stop polling |
| `getPolls()` | Polling | List active polls + change history |
| `mark(label, data?)` | Timeline | Add timestamped annotation |
| `getTimeline(opts?)` | Timeline | Get chronological events (filterable) |
| `getSnapshot()` | Snapshot | Full dump: watches + interceptions + polls + timeline |
| `isInjected` | Metadata | `true` — detection flag |
| `version` | Metadata | Script version string |

---

## 1. State Tracking

Track JavaScript values with full change history. Works from both **runtime evaluate** and **source code instrumentation**.

### watch(key, value, opts?)

```javascript
// Runtime: via browser_evaluate
() => __debugAgent.watch('auth.userId', document.cookie.match(/uid=([^;]+)/)?.[1])

// Runtime: with options
() => __debugAgent.watch('cart.items', window.__store?.getState()?.cart?.items, {
  context: 'After add-to-cart click',
  metadata: { source: 'redux' },
  maxHistory: 100
})

// Code instrumentation: add to source file
window.__debugAgent?.watch('UserProfile.userId', userId, { context: 'prop received' });
```

**Options**: `{ metadata?: object, context?: string, maxHistory?: number }`

### get(key)

```javascript
// Returns entry with full history and ISO timestamps
() => __debugAgent.get('auth.userId')
// → { key, currentValue, updateCount, firstWatched, lastUpdated, metadata, history: [...] }
```

### getAll() / getKeys() / unwatch(key) / clear()

```javascript
() => __debugAgent.getAll()        // All entries as array
() => __debugAgent.getKeys()       // ['auth.userId', 'cart.items', ...]
() => __debugAgent.unwatch('key')  // Remove one entry, returns boolean
() => __debugAgent.clear()         // Remove all entries
```

---

## 2. Function Interception

Monkey-patch any function accessible from `window` to record every call. **Runtime only.**

### intercept(path, opts?)

```javascript
// Intercept fetch — records all HTTP calls
() => __debugAgent.intercept('fetch')

// Intercept localStorage writes
() => __debugAgent.intercept('localStorage.setItem')

// Intercept SPA navigation
() => __debugAgent.intercept('history.pushState')

// Intercept app-specific function
() => __debugAgent.intercept('myApp.api.getUser')

// With options
() => __debugAgent.intercept('fetch', {
  key: 'api-calls',       // custom key (default: 'intercept:<path>')
  recordArgs: true,        // record call arguments (default: true)
  recordReturn: true,      // record return values (default: true)
  errorsOnly: false         // only record calls that throw (default: false)
})
```

**Returns**: the tracking key string, or `null` if path doesn't resolve to a function.

### restore(path)

```javascript
// Undo interception, restore original function
() => __debugAgent.restore('fetch')  // returns true/false
```

### getInterceptions()

```javascript
// List all active interceptions with their call logs
() => __debugAgent.getInterceptions()
// → [{ path, key, callCount, calls: [{ callIndex, timestamp, args, returnValue, duration, error, async }] }]
```

### Interception Recipes

**Track all API calls:**
```javascript
() => {
  __debugAgent.intercept('fetch');
  __debugAgent.intercept('XMLHttpRequest.prototype.open');
}
```

**Track storage mutations:**
```javascript
() => {
  __debugAgent.intercept('localStorage.setItem');
  __debugAgent.intercept('localStorage.removeItem');
  __debugAgent.intercept('sessionStorage.setItem');
}
```

**Track only errors:**
```javascript
() => __debugAgent.intercept('fetch', { errorsOnly: true })
```

**Read recent fetch calls:**
```javascript
() => {
  var data = __debugAgent.getInterceptions();
  var fetchCalls = data.find(d => d.path === 'fetch');
  return fetchCalls ? fetchCalls.calls.slice(-5) : [];
}
```

---

## 3. Expression Polling

Periodically evaluate a JavaScript expression and track changes. Like DevTools watch expressions with history. **Runtime only.**

### poll(key, expression, opts?)

```javascript
// Poll DOM element count every second
() => __debugAgent.poll('rowCount', "document.querySelectorAll('.data-row').length")

// Poll framework store state
() => __debugAgent.poll('authStatus', "window.__REDUX_STORE__?.getState()?.auth?.status")

// Poll with faster interval, record every tick
() => __debugAgent.poll('url', "location.pathname + location.hash", {
  intervalMs: 250,
  onlyChanges: false   // record even when unchanged (default: true = only changes)
})
```

**Options**: `{ intervalMs?: number (default 1000), onlyChanges?: boolean (default true) }`

### stopPoll(key) / getPolls()

```javascript
() => __debugAgent.stopPoll('rowCount')  // returns true/false
() => __debugAgent.getPolls()
// → [{ key, expression, intervalMs, onlyChanges, changeCount, lastValue, changes: [...] }]
```

### Polling Recipes

**Watch for error banners appearing:**
```javascript
() => __debugAgent.poll('errors', "document.querySelectorAll('[role=alert]').length", { intervalMs: 500 })
```

**Track React component count:**
```javascript
() => __debugAgent.poll('components', "document.querySelectorAll('[data-testid]').length")
```

**Monitor network indicator:**
```javascript
() => __debugAgent.poll('offline', "!navigator.onLine", { intervalMs: 2000 })
```

---

## 4. Timeline & Markers

Unified chronological view of ALL events from all subsystems. Every `watch`, `intercept` call, and `poll` change automatically appears here.

### mark(label, data?)

```javascript
// Annotate what the agent did — helpful for correlating cause/effect
() => __debugAgent.mark('clicked-submit-button')
() => __debugAgent.mark('navigated-to-settings', { url: '/settings', reason: 'user request' })
```

### getTimeline(opts?)

```javascript
// All events
() => __debugAgent.getTimeline()

// Filter by type
() => __debugAgent.getTimeline({ types: ['intercept'] })

// Filter by key
() => __debugAgent.getTimeline({ keys: ['fetch', 'auth.userId'] })

// Filter by time
() => __debugAgent.getTimeline({ since: '2026-04-17T23:05:00Z' })

// Last N entries
() => __debugAgent.getTimeline({ last: 20 })

// Combined filters
() => __debugAgent.getTimeline({ types: ['intercept', 'watch'], last: 30 })
```

**Options**: `{ types?: string[], keys?: string[], since?: string, last?: number }`

**Timeline entry format:**
```json
{
  "type": "watch|intercept|poll|mark",
  "key": "string",
  "timestamp": "ISO string",
  "data": { /* type-specific payload */ }
}
```

---

## 5. Snapshot

Full state dump across all subsystems.

### getSnapshot()

```javascript
() => __debugAgent.getSnapshot()
```

**Returns:**
```json
{
  "url": "https://example.com/app",
  "timestamp": "2026-04-17T23:10:00.000Z",
  "version": "1.0.0",
  "stats": {
    "watchedKeys": 5,
    "activeInterceptions": 2,
    "activePolls": 1,
    "timelineEntries": 47
  },
  "watches": [ /* serialized watch entries */ ],
  "interceptions": [ /* interception records with call logs */ ],
  "polls": [ /* poll records with change history */ ],
  "timeline": [ /* full timeline */ ]
}
```

---

## Code Instrumentation Templates

When adding `watch()` calls to source code, use optional chaining so it's a no-op when the script isn't injected.

### React Component Props/State

```typescript
function UserProfile({ userId }: Props) {
  const [profile, setProfile] = useState(null);

  // Track props and state — place after declarations, before effects
  window.__debugAgent?.watch('UserProfile.userId', userId, {
    context: 'prop received',
    metadata: { component: 'UserProfile' }
  });
  window.__debugAgent?.watch('UserProfile.profile', profile, {
    context: 'state value'
  });

  // ... rest of component
}
```

### Service/API Functions

```typescript
async function fetchUsers() {
  window.__debugAgent?.watch('api.fetchUsers', 'loading', { context: 'Starting fetch' });

  try {
    const users = await api.get('/users');
    window.__debugAgent?.watch('api.fetchUsers', { status: 'success', count: users.length }, {
      context: `Loaded ${users.length} users`
    });
    return users;
  } catch (error) {
    window.__debugAgent?.watch('api.fetchUsers', { status: 'error' }, { context: error.message });
    throw error;
  }
}
```

### Key Naming Convention

Format: `<scope>.<identifier>` — keep it readable and searchable.

| Scope | Example Key |
|---|---|
| Component name | `UserProfile.userId`, `CartView.items` |
| Module/service | `api.fetchUsers`, `auth.tokenStatus` |
| Feature area | `checkout.step`, `search.query` |

### Cleanup

When done debugging, remove all added instrumentation:

```bash
# Find all instrumentation in modified files
git diff --name-only | xargs grep -l "__debugAgent"

# Patterns to remove:
# - window.__debugAgent?.watch(...)   — entire statement
# - window.__debugAgent?.mark(...)    — entire statement
```

---

## Browser Automation Tools (use these too!)

Your browser automation tool already handles these — use them alongside `__debugAgent`:

| Need | What to look for |
|---|---|
| Console output | Console/log retrieval tool (e.g., `browser_console_messages`, `list_console_messages`) |
| Network requests | Network request log tool (e.g., `browser_network_requests`, `list_network_requests`) |
| Screenshot | Screenshot tool (e.g., `browser_take_screenshot`, `take_screenshot`) |
| DOM tree | Page snapshot tool (e.g., `browser_snapshot`, `take_snapshot`) |
| Run JS once | JS evaluation tool — the same one used to call `__debugAgent` methods |

---

## Common Investigation Workflows

### Workflow: Debug a button click

```
1. intercept('fetch')              — catch API calls
2. mark('about-to-click')          — annotate
3. [click the button via browser automation]
4. getTimeline({ last: 10 })       — see what happened
5. getInterceptions()              — check fetch call details
```

### Workflow: Track state during navigation

```
1. poll('url', 'location.pathname')
2. poll('authState', 'window.__store__?.getState()?.auth')
3. [navigate through the app]
4. getPolls()                      — see all state changes over time
```

### Workflow: Find why a value is wrong

```
1. Add watch() calls in source code at key points
2. Rebuild / wait for HMR
3. Reproduce the issue
4. get('suspectKey')               — see full history of changes
5. getTimeline({ keys: ['suspectKey'] }) — see context
```

### Workflow: Full investigation snapshot

```
1. Set up interceptions + polls + watchers
2. Interact with the app / reproduce the bug
3. getSnapshot()                   — get everything in one call
4. [include in report]
```
