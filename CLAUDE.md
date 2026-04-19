# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Automate Habitica+** is a Google Apps Script (GAS) project that automates Habitica gameplay. It runs entirely on Google's cloud — there is no local build, test runner, or lint step. The `.gs` files here are edited locally and deployed to GAS manually via the web UI or `clasp`.

## Architecture

### Execution model

There are two entry points, both in `global.gs`:

- **`onTrigger()`** — called every 10 minutes by a GAS time-based trigger. Re-enables disabled webhooks, then runs `processTrigger()` + `processQueue()`.
- **`doPost(e)`** — called by Habitica webhooks (task scored, quest events, chat, etc.). Parses the payload into `webhookData`, calls `processWebhook()`, then `processQueue()`.

### Task queue

Automations are not called directly. Instead, `processTrigger()` and `processWebhook()` write flags (e.g. `"runCron"`, `"purchaseArmoires"`) into GAS `ScriptProperties`. `processQueue()` reads those flags in priority order and dispatches to the automation functions, using `LockService` to prevent concurrent runs.

`interruptLoop()` (called inside long-running loops) drains urgent queue items and returns `true` if the 4.5-minute script timeout is approaching.

### Files

| File | Purpose |
|---|---|
| `setup.gs` | **User-editable**: all feature flags and tuning constants (`const USER_ID`, `AUTO_CRON`, `BANNED_SCROLLS`, etc.). Also contains `install()`, `uninstall()`, `validateConstants()`, trigger/webhook management. |
| `global.gs` | Core orchestration: entry points, queue processor, skill dispatchers, GAS API wrappers (`fetch`, `getUser`, `getParty`, `getMembers`, `getContent`, `getTasks`/`getDailies`), `getQuestCompletionData()`. |
| `constants.gs` | Read-only game constants (mana costs, damage formulas, thresholds). Not user-editable. |
| `automations/*.gs` | One file per automation feature. Each implements one or more functions that are called from `processQueue()`. |

### Caching pattern

`global.gs` uses module-level `let` variables (`user`, `party`, `members`, `content`, `tasks`, `dailies`) as per-execution caches. Each getter (`getUser`, `getParty`, etc.) accepts an optional `updated` boolean to force a re-fetch.

### API calls

All Habitica API calls go through the `fetch()` wrapper in `global.gs`, which handles rate-limit spacing, retry on 5xx, and server downtime.

## Deployment workflow

`.clasp.json` is gitignored because it contains a personal `scriptId`. To set up clasp for the first time:

```
npm install -g @google/clasp
clasp login
clasp clone <scriptId>   # scriptId found in GAS editor → Project Settings
```

To apply changes:

1. Edit `.gs` files locally.
2. Push to GAS via `clasp push`.
3. In the GAS editor: **Deploy → Manage deployments → New version → Deploy**.
4. Run the `install` function from the GAS editor to re-register triggers and webhooks.

There is no automated test suite. Validate logic changes by running `install` and observing GAS execution logs.

## Adding a new automation

1. Create `automations/myFeature.gs` implementing the automation function(s).
2. Add a feature flag constant to `setup.gs` (follow existing naming conventions).
3. In `global.gs`, add queue flag writes in `processTrigger()` and/or `processWebhook()`.
4. In `processQueue()`, add a dispatch block in priority order (urgent tasks first, expensive tasks last).
5. Add validation for the new constant(s) in `validateConstants()` in `setup.gs`.
