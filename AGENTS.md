# AGENTS.md

## Project rules

- This plugin is intended for **private distribution only**.
- Publish it only to **GitHub Packages** under the `@lucasortis` scope.
- Do **not** publish this project to the public npm registry.
- Keep the repository private unless explicitly changed by the owner.

## Packaging and release policy

- The published artifact must come from `dist/`.
- Keep `exports["./tui"]` pointing at the built JavaScript entrypoint.
- Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run pack:check` before release changes are finalized.
- Package publication should happen through the GitHub Actions release workflow when possible.

## Testing policy

- Keep lightweight automated tests for stable logic such as formatting, parsing, cache helpers, and packaging checks.
- Avoid brittle runtime tests that require the full OpenCode/Bun host unless they are explicitly scoped as integration tests.

## Dependency policy

- Keep dependencies and GitHub Actions updated through Dependabot and normal maintenance.
- Prefer the newest stable versions that work with local type-checking, tests, and packaging.
- If a warning comes from a transitive dependency, prefer `overrides` instead of adding extra direct runtime dependencies unless a direct dependency is actually needed.

## Release versioning

- Keep the package version aligned with the Git tag/release version.
- Use semver tags like `v0.0.1` for GitHub releases.

## Commit policy

- Each new completed change should be committed promptly instead of being left uncommitted.
- Keep commits focused and descriptive so the repository history stays easy to follow.
