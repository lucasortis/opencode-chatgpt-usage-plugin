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

Run tests:

```bash
npm test
```

Build the distributable package:

```bash
npm run build
```

One-shot release and local OpenCode update:

```bash
npm run release:update-opencode
```

Optional version bump inputs:

```bash
npm run release:update-opencode -- patch
npm run release:update-opencode -- minor
npm run release:update-opencode -- 0.0.4
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

### Option B: private remote package

This repository is now prepared to be published privately through GitHub Packages.

1. Publish the package from this repository:

```bash
npm install
npm test
npm run build
npm publish
```

2. Add GitHub Packages auth to your global `~/.npmrc` so OpenCode can install the private package from its cache directory:

```ini
@lucasortis:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Use a GitHub token with at least:

- `read:packages` to install the package in OpenCode
- `write:packages` to publish new versions

3. Reference the package in `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "@lucasortis/opencode-chatgpt-usage-plugin"
  ]
}
```

### Automatic publishing with GitHub Actions

This repository now includes:

- `CI` workflow for install, typecheck, test, build, and `npm pack --dry-run`
- `Publish package` workflow that publishes automatically when you publish a GitHub Release
- `Dependabot` updates for npm dependencies and GitHub Actions

Recommended release flow:

```bash
npm version patch
git push --follow-tags
```

Then publish a GitHub Release for the new tag. The publish workflow will build, test, and publish the package to GitHub Packages automatically.

If you want one command to do all of this, use `npm run release:update-opencode`. It will:

1. bump the version
2. run typecheck, tests, build, and pack checks
3. commit and push `main`
4. wait for CI to pass
5. create the GitHub release
6. wait for the publish workflow to finish
7. prewarm the local OpenCode cache with the published package
8. smoke-test the published plugin against the local BTCA `opencode` clone

### Option C: project-local config

If you only want it enabled for one repo, add the same plugin path to that repo's `.opencode/tui.json` instead of your global OpenCode config.

## Example output

```text
Plan: pro
5h limit: 42% left · resets Apr 19, 14:30
Weekly limit: 68% left · resets Apr 22, 09:00
Credits: Unlimited
Image generation: 80% left · resets Apr 19, 18:00
```

## Package notes

- `private: true` was removed from `package.json` because npm uses that flag to block publishing entirely
- the distributed entrypoint is built into `dist/tui.jsx`
- the package is intended for private distribution through GitHub Packages, not the public npm registry

## Notes

- this is ChatGPT plan usage, not OpenAI API billing usage
- expired or disconnected OpenCode OpenAI sessions return a clear error in the dialog
- optional override token values are never logged by the plugin
- this project should stay private even though it is now publishable as a package
