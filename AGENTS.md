# AI Debugger

This repository is a plugin for AI coding agents. It provides a runtime debugging toolkit that can be injected into any web page via browser automation.

## For AI Agents

Read `skills/ai-debugger/SKILL.md` for the full skill definition, workflows, and API reference.

## Quick Start

1. Navigate to the target web page using your browser automation tool
2. Read `skills/ai-debugger/reference/debug-agent.js` and evaluate it in the page
3. Call `window.__debugAgent` APIs via your JS evaluation tool

## Capabilities

- **State Tracking** — `watch(key, value)` to track values with history
- **Function Interception** — `intercept('fetch')` to record all calls to any function
- **Expression Polling** — `poll(key, expr)` to periodically evaluate expressions
- **Timeline** — `mark(label)` to annotate, `getTimeline()` to see everything
- **Snapshot** — `getSnapshot()` for a full dump of all tracked data
