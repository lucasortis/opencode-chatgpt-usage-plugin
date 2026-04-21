#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCODE_DIR="$HOME/.btca/agent/sandbox/opencode"
PACKAGE_NAME="@lucasortis/opencode-chatgpt-usage-plugin"
CACHE_DIR="$HOME/.cache/opencode/packages/@lucasortis/opencode-chatgpt-usage-plugin@latest"
VERSION_INPUT="${1:-patch}"

cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command git
require_command npm
require_command node
require_command gh
require_command bun

if [[ ! -d "$OPENCODE_DIR" ]]; then
  echo "Expected local opencode clone at $OPENCODE_DIR" >&2
  echo "Clone or preload it via BTCA Local first." >&2
  exit 1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "This script must be run from the main branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "Working tree has local changes. They will be included in this release." >&2
fi

GITHUB_PACKAGES_TOKEN="${GITHUB_PACKAGES_TOKEN:-$(gh auth token)}"
export GITHUB_PACKAGES_TOKEN
export NPM_CONFIG_USERCONFIG="$HOME/.npmrc"

CURRENT_VERSION="$(node -p 'require("./package.json").version')"

normalize_version() {
  local input="$1"
  if [[ "$input" =~ ^v ]]; then
    printf '%s' "${input#v}"
    return
  fi
  printf '%s' "$input"
}

case "$VERSION_INPUT" in
  patch|minor|major|prepatch|preminor|premajor|prerelease)
    npm version "$VERSION_INPUT" --no-git-tag-version >/dev/null
    ;;
  *)
    npm version "$(normalize_version "$VERSION_INPUT")" --no-git-tag-version >/dev/null
    ;;
esac

NEW_VERSION="$(node -p 'require("./package.json").version')"
TAG="v$NEW_VERSION"

if [[ "$NEW_VERSION" == "$CURRENT_VERSION" ]]; then
  echo "Version did not change; aborting." >&2
  exit 1
fi

echo "==> Running validation checks for $TAG"
npm run typecheck
npm test
npm run build
npm run pack:check

echo "==> Creating commit for $TAG"
git add -A
git commit -m "release: $TAG" -m "Validate, publish, and update the OpenCode plugin cache for $TAG." 

HEAD_SHA="$(git rev-parse HEAD)"

echo "==> Pushing main"
git push origin main

find_run_id() {
  local workflow_name="$1"
  local match_key="$2"
  local match_value="$3"
  gh run list --workflow "$workflow_name" --limit 20 --json databaseId,headSha,displayTitle | \
    node -e '
      const fs = require("fs")
      const rows = JSON.parse(fs.readFileSync(0, "utf8"))
      const [, , key, value] = process.argv
      const hit = rows.find((row) => String(row[key] ?? "") === value)
      if (hit) process.stdout.write(String(hit.databaseId))
    ' _ "$match_key" "$match_value"
}

echo "==> Waiting for CI on $HEAD_SHA"
CI_RUN_ID=""
for _ in {1..20}; do
  CI_RUN_ID="$(find_run_id "CI" "headSha" "$HEAD_SHA")"
  if [[ -n "$CI_RUN_ID" ]]; then
    break
  fi
  sleep 3
done

if [[ -z "$CI_RUN_ID" ]]; then
  echo "Unable to find CI run for commit $HEAD_SHA" >&2
  exit 1
fi

gh run watch "$CI_RUN_ID" --exit-status

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists." >&2
  exit 1
fi

echo "==> Creating GitHub release $TAG"
gh release create "$TAG" --title "$TAG" --notes "## Summary
- release $TAG
- validate checks locally before publishing
- update the OpenCode cache and smoke-test the published plugin"

echo "==> Waiting for publish workflow for $TAG"
PUBLISH_RUN_ID=""
for _ in {1..20}; do
  PUBLISH_RUN_ID="$(find_run_id "Publish package" "displayTitle" "$TAG")"
  if [[ -n "$PUBLISH_RUN_ID" ]]; then
    break
  fi
  sleep 3
done

if [[ -z "$PUBLISH_RUN_ID" ]]; then
  echo "Unable to find publish workflow for $TAG" >&2
  exit 1
fi

gh run watch "$PUBLISH_RUN_ID" --exit-status

echo "==> Verifying published package version"
npm view "$PACKAGE_NAME@$NEW_VERSION" version --registry=https://npm.pkg.github.com >/dev/null

echo "==> Updating OpenCode cache with $PACKAGE_NAME@$NEW_VERSION"
rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
npm install --prefix "$CACHE_DIR" "$PACKAGE_NAME@$NEW_VERSION"

echo "==> Updating local BTCA opencode clone"
git -C "$OPENCODE_DIR" pull --ff-only >/dev/null

echo "==> Smoke testing plugin load through OpenCode loader"
PACKAGE_NAME="$PACKAGE_NAME" bun --cwd "$OPENCODE_DIR/packages/opencode" -e '
  import "@opentui/solid/runtime-plugin-support"
  const spec = process.env.PACKAGE_NAME
  const { PluginLoader } = await import("./src/plugin/loader.ts")
  const { readV1Plugin, readPluginId, resolvePluginId } = await import("./src/plugin/shared.ts")

  const resolved = await PluginLoader.resolve({ spec, options: undefined, deprecated: false }, "tui")
  if (!resolved.ok) {
    console.error(JSON.stringify(resolved, null, 2))
    process.exit(1)
  }

  const loaded = await PluginLoader.load(resolved.value)
  if (!loaded.ok) {
    console.error(loaded.error)
    process.exit(1)
  }

  const plugin = readV1Plugin(loaded.value.mod, spec, "tui")
  const id = await resolvePluginId(
    loaded.value.source,
    loaded.value.spec,
    loaded.value.target,
    readPluginId(plugin?.id, loaded.value.spec),
    loaded.value.pkg,
  )

  console.log(JSON.stringify({
    ok: true,
    version: loaded.value.pkg?.json.version,
    id,
    entry: loaded.value.entry,
    target: loaded.value.target,
  }, null, 2))
'

echo
echo "Release $TAG published and validated."
echo "Restart OpenCode to load the updated plugin."
