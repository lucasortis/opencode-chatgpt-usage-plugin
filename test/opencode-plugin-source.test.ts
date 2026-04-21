import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
  LOCAL_PLUGIN_PATH,
  PACKAGE_PLUGIN_SPEC,
  switchOpenCodePluginSource,
} from "../scripts/set-opencode-plugin-source.mjs"

test("switchOpenCodePluginSource writes the local plugin path", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await switchOpenCodePluginSource("local", configPath)

  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(config.$schema, "https://opencode.ai/tui.json")
  assert.deepEqual(config.plugin, [LOCAL_PLUGIN_PATH])
})

test("switchOpenCodePluginSource preserves other config while switching to the package", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await writeFile(
    configPath,
    JSON.stringify({
      $schema: "https://opencode.ai/tui.json",
      theme: "dark",
      plugin: ["old-plugin"],
    }),
    "utf8",
  )

  await switchOpenCodePluginSource("package", configPath)

  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(config.theme, "dark")
  assert.deepEqual(config.plugin, [PACKAGE_PLUGIN_SPEC])
})
