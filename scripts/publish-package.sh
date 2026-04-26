#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
NPM_REGISTRY_URL="${NPM_REGISTRY_URL:-https://registry.npmjs.org/}"

cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command npm

npm run typecheck
npm test
npm run build
npm run pack:check
npm publish --access public --registry "$NPM_REGISTRY_URL"
