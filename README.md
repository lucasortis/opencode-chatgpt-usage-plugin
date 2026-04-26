# OpenCode ChatGPT Usage Plugin

OpenCode TUI plugin that adds `/gpt-usage` with `/usage` alias to show ChatGPT plan usage limits from `https://chatgpt.com/backend-api/wham/usage`.

## Install

```bash
npx @lucasortis/opencode-chatgpt-usage-plugin install
```

The installer updates `~/.config/opencode/tui.json`, preserves existing plugins, avoids duplicate entries, and uses the public npm package. Restart or reload OpenCode after installing.

To use a custom config path:

```bash
npx @lucasortis/opencode-chatgpt-usage-plugin install --config ~/.config/opencode/tui.json
```

## Commands

- `/gpt-usage`
- `/usage`

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

- `GPT_USAGE_TOKEN`: required ChatGPT bearer token
- `GPT_USAGE_ACCOUNT_ID`: optional ChatGPT account id

These overrides are only needed if you want to bypass the stored OpenCode login.

This uses ChatGPT web auth, not a standard OpenAI API key.

## Manual Configuration

If you prefer not to run the installer, add the package spec to `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "@lucasortis/opencode-chatgpt-usage-plugin"
  ]
}
```

If you only want it enabled for one repo, add the same plugin entry to that repo's `.opencode/tui.json` instead.

## Remove

```bash
npx @lucasortis/opencode-chatgpt-usage-plugin uninstall
```

With a custom config path:

```bash
npx @lucasortis/opencode-chatgpt-usage-plugin uninstall --config ~/.config/opencode/tui.json
```

You can also remove `@lucasortis/opencode-chatgpt-usage-plugin` manually from the `plugin` array in `tui.json`.

## Development

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

Load the local source plugin while developing:

```bash
npm run opencode:plugin:local
```

Switch back to the published package spec:

```bash
npm run opencode:plugin:package
```

## Release

Validate package contents before publishing:

```bash
npm run typecheck
npm test
npm run build
npm run pack:check
```

Prepare a version bump and local tag:

```bash
npm run release:package -- patch
git push origin main --tags
```

Publishing is handled by the `Publish package` GitHub Actions workflow when a GitHub Release is published. Configure npm Trusted Publishing for this repository instead of storing an npm token in GitHub secrets.

Manual publishing is also available:

```bash
npm run publish:package
```

## Troubleshooting

Check whether the plugin is configured:

```bash
npx @lucasortis/opencode-chatgpt-usage-plugin doctor
```

Run an installer smoke test with a temporary config file:

```bash
npm run smoke:install
```

If OpenCode does not show `/gpt-usage`, restart or reload OpenCode and confirm that `tui.json` contains the package spec.

## Example Output

<img width="748" height="595" alt="image" src="https://github.com/user-attachments/assets/32a4126b-ee1f-42f2-8bda-64ce3b00099d" />


## Contributing

Issues are welcome for bug reports, usage questions, and feature suggestions.

External pull requests are closed automatically. Valid pull requests are limited to `lucasortis` and `dependabot[bot]`.

## Notes

- this is ChatGPT plan usage, not OpenAI API billing usage
- expired or disconnected OpenCode OpenAI sessions return a clear error in the dialog
- optional override token values are never logged by the plugin
