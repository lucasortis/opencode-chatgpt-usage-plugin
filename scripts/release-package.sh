#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_INPUT="${1:-patch}"

cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

normalize_version() {
  local input="$1"
  printf '%s' "${input#v}"
}

bump_version() {
  case "$VERSION_INPUT" in
    patch|minor|major|prepatch|preminor|premajor|prerelease)
      npm version "$VERSION_INPUT" --no-git-tag-version >/dev/null
      ;;
    *)
      npm version "$(normalize_version "$VERSION_INPUT")" --no-git-tag-version >/dev/null
      ;;
  esac
}

require_clean_main() {
  if [[ "$(git branch --show-current)" != "main" ]]; then
    printf 'This script must be run from the main branch.\n' >&2
    exit 1
  fi
}

run_validation() {
  npm run typecheck
  npm test
  npm run build
  npm run pack:check
}

create_release_commit() {
  local tag="$1"
  git add package.json package-lock.json
  git commit -m "release: $tag" -m "Validate the public npm package before publishing $tag."
  git tag "$tag"
}

require_command git
require_command npm
require_command node
require_clean_main

CURRENT_VERSION="$(node -p 'require("./package.json").version')"
bump_version
NEW_VERSION="$(node -p 'require("./package.json").version')"
TAG="v$NEW_VERSION"

if [[ "$NEW_VERSION" == "$CURRENT_VERSION" ]]; then
  printf 'Version did not change; aborting.\n' >&2
  exit 1
fi

run_validation
create_release_commit "$TAG"

printf 'Prepared %s. Push with: git push origin main --tags\n' "$TAG"
