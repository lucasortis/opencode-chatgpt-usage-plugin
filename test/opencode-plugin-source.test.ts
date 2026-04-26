import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
  configureOpenCodePluginSource,
  installOpenCodePlugin,
  LOCAL_PLUGIN_PATH,
  PACKAGE_PLUGIN_SPEC,
  uninstallOpenCodePlugin,
} from "../scripts/install-opencode-plugin.mjs"

test("configureOpenCodePluginSource writes the local plugin path", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await configureOpenCodePluginSource("local", configPath)

  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(config.$schema, "https://opencode.ai/tui.json")
  assert.deepEqual(config.plugin, [LOCAL_PLUGIN_PATH])
})

test("installOpenCodePlugin preserves existing plugins", async () => {
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

  await installOpenCodePlugin({ configPath })

  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(config.theme, "dark")
  assert.deepEqual(config.plugin, ["old-plugin", PACKAGE_PLUGIN_SPEC])
})

test("installOpenCodePlugin creates config when it does not exist", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "nested", "tui.json")

  const result = await installOpenCodePlugin({ configPath })
  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(result.changed, true)
  assert.equal(config.$schema, "https://opencode.ai/tui.json")
  assert.deepEqual(config.plugin, [PACKAGE_PLUGIN_SPEC])
})

test("installOpenCodePlugin is idempotent", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await installOpenCodePlugin({ configPath })
  const result = await installOpenCodePlugin({ configPath })
  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(result.changed, false)
  assert.deepEqual(config.plugin, [PACKAGE_PLUGIN_SPEC])
})

test("installOpenCodePlugin fails clearly for invalid JSON", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await writeFile(configPath, "{broken", "utf8")

  await assert.rejects(
    installOpenCodePlugin({ configPath }),
    new RegExp(`Invalid JSON in '${configPath.replaceAll("\\", "\\\\")}'. Expected a JSON object.`),
  )
})

test("uninstallOpenCodePlugin removes only the package plugin", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "opencode-plugin-source-"))
  const configPath = path.join(tempDir, "tui.json")

  await installOpenCodePlugin({ configPath, pluginEntry: "old-plugin" })
  await installOpenCodePlugin({ configPath })
  const result = await uninstallOpenCodePlugin({ configPath })
  const config = JSON.parse(await readFile(configPath, "utf8"))

  assert.equal(result.changed, true)
  assert.deepEqual(config.plugin, ["old-plugin"])
})
