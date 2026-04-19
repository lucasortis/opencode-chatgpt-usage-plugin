# AGENT.md

## Project rules

- This plugin is **local-only**.
- **Never publish this project to npm**.
- Keep the package marked `"private": true`.
- Prefer local OpenCode file-plugin loading for development and usage.

## Dependency policy

- Keep dependencies updated enough to avoid avoidable npm warnings and audit noise.
- Prefer the newest stable versions that work with local type-checking.
- If a warning comes from a transitive dependency, prefer `overrides` instead of adding extra direct runtime dependencies unless a direct dependency is actually needed.
