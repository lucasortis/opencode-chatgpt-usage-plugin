#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { installOpenCodePlugin, PACKAGE_PLUGIN_SPEC } from "./install-opencode-plugin.mjs"

const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-chatgpt-usage-plugin-"))
const configPath = path.join(tempDir, "tui.json")

try {
  await installOpenCodePlugin({ configPath })
  await installOpenCodePlugin({ configPath })

  const config = JSON.parse(await readFile(configPath, "utf8"))
  const plugins = Array.isArray(config.plugin) ? config.plugin : []
  const occurrences = plugins.filter((plugin) => plugin === PACKAGE_PLUGIN_SPEC).length

  if (occurrences !== 1) {
    throw new Error(`Expected one '${PACKAGE_PLUGIN_SPEC}' entry, found ${occurrences}.`)
  }

  console.log(`Smoke test passed: ${configPath}`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
