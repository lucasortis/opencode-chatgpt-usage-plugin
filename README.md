# OpenCode ChatGPT Usage Plugin

OpenCode TUI plugin that adds `/gpt-usage` with `/usage` alias to show ChatGPT plan usage limits from `https://chatgpt.com/backend-api/wham/usage`.

## Features

- shows cached usage immediately when available
- refreshes usage in the background
- replaces the dialog with fresh data when the refresh completes
- stores the last successful snapshot in OpenCode KV
- supports primary, secondary, credits, and additional usage buckets
- uses your existing OpenCode OpenAI/ChatGPT login by default

## Authentication

By default, the plugin reads your existing OpenCode `openai` OAuth session and refreshes it when needed.

Optional overrides:

- `GPT_USAGE_TOKEN` — required ChatGPT bearer token
- `GPT_USAGE_ACCOUNT_ID` — optional ChatGPT account id

These overrides are only needed if you want to bypass the stored OpenCode login.

> This uses ChatGPT web auth, not a standard OpenAI API key.

## Commands

- `/gpt-usage`
- `/usage`

## Local development

Install dependencies:

```bash
npm install
```

Type-check:

```bash
npm run typecheck
```

## Load in OpenCode

### Option A: local file plugin

Add the plugin module path to `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "/absolute/path/to/opencode-chatgpt-usage-plugin/src/tui.tsx"
  ]
}
```

### Option B: project-local config

If you only want it enabled for one repo, add the same plugin path to that repo's `.opencode/tui.json` instead of your global OpenCode config.

## Example output

```text
Plan: pro
5h limit: 42% left · resets Apr 19, 14:30
Weekly limit: 68% left · resets Apr 22, 09:00
Credits: Unlimited
Image generation: 80% left · resets Apr 19, 18:00
```

## Notes

- this is ChatGPT plan usage, not OpenAI API billing usage
- expired or disconnected OpenCode OpenAI sessions return a clear error in the dialog
- optional override token values are never logged by the plugin
- this project is local-only and should never be published to npm
