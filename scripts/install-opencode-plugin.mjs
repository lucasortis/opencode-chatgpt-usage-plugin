#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_SCHEMA = "https://opencode.ai/tui.json"
const PACKAGE_JSON_URL = new URL("../package.json", import.meta.url)

export const PACKAGE_PLUGIN_SPEC = JSON.parse(await readFile(PACKAGE_JSON_URL, "utf8")).name
export const LOCAL_PLUGIN_PATH = path.resolve(fileURLToPath(new URL("../src/tui.tsx", import.meta.url)))
export const DEFAULT_CONFIG_PATH = path.join(homedir(), ".config", "opencode", "tui.json")

/**
 * Return the OpenCode plugin spec for package or local development installs.
 *
 * Example:
 * ```js
 * resolvePluginEntry("package")
 * ```
 *
 * @param {"local" | "package"} source
 * @returns {string}
 */
export function resolvePluginEntry(source) {
  if (source === "local") return LOCAL_PLUGIN_PATH
  if (source === "package") return PACKAGE_PLUGIN_SPEC
  throw new Error(`Unknown plugin source '${source}'. Expected 'local' or 'package'.`)
}

/**
 * Read an OpenCode TUI config, returning an empty config when it does not exist.
 *
 * Example:
 * ```js
 * await readOpenCodeConfig("/tmp/tui.json")
 * ```
 *
 * @param {string} configPath
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readOpenCodeConfig(configPath) {
  try {
    return parseOpenCodeConfig(await readFile(configPath, "utf8"), configPath)
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return {}
    throw error
  }
}

/**
 * Add the plugin to an OpenCode TUI config without removing existing plugins.
 *
 * Example:
 * ```js
 * await installOpenCodePlugin({ configPath: "/tmp/tui.json" })
 * ```
 *
 * @param {{ configPath?: string, pluginEntry?: string }} options
 * @returns {Promise<{ configPath: string, pluginEntry: string, changed: boolean }>}
 */
export async function installOpenCodePlugin(options = {}) {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH
  const pluginEntry = options.pluginEntry ?? PACKAGE_PLUGIN_SPEC
  const existingConfig = await readOpenCodeConfig(configPath)
  const existingPlugins = readPluginArray(existingConfig, configPath)
  const changed = !existingPlugins.includes(pluginEntry)
  const nextPlugins = changed ? [...existingPlugins, pluginEntry] : existingPlugins

  await writeOpenCodeConfig(configPath, { ...existingConfig, $schema: readSchema(existingConfig), plugin: nextPlugins })
  return { configPath, pluginEntry, changed }
}

/**
 * Remove the plugin from an OpenCode TUI config without touching other plugins.
 *
 * Example:
 * ```js
 * await uninstallOpenCodePlugin({ configPath: "/tmp/tui.json" })
 * ```
 *
 * @param {{ configPath?: string, pluginEntry?: string }} options
 * @returns {Promise<{ configPath: string, pluginEntry: string, changed: boolean }>}
 */
export async function uninstallOpenCodePlugin(options = {}) {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH
  const pluginEntry = options.pluginEntry ?? PACKAGE_PLUGIN_SPEC
  const existingConfig = await readOpenCodeConfig(configPath)
  const existingPlugins = readPluginArray(existingConfig, configPath)
  const nextPlugins = existingPlugins.filter((plugin) => plugin !== pluginEntry)

  await writeOpenCodeConfig(configPath, { ...existingConfig, $schema: readSchema(existingConfig), plugin: nextPlugins })
  return { configPath, pluginEntry, changed: nextPlugins.length !== existingPlugins.length }
}

/**
 * Inspect whether the configured OpenCode TUI file already contains the plugin.
 *
 * Example:
 * ```js
 * await inspectOpenCodePlugin({ configPath: "/tmp/tui.json" })
 * ```
 *
 * @param {{ configPath?: string, pluginEntry?: string }} options
 * @returns {Promise<{ configPath: string, pluginEntry: string, exists: boolean, configured: boolean }>}
 */
export async function inspectOpenCodePlugin(options = {}) {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH
  const pluginEntry = options.pluginEntry ?? PACKAGE_PLUGIN_SPEC
  const exists = await pathExists(configPath)
  const existingConfig = exists ? await readOpenCodeConfig(configPath) : {}
  const plugins = exists ? readPluginArray(existingConfig, configPath) : []

  return { configPath, pluginEntry, exists, configured: plugins.includes(pluginEntry) }
}

/**
 * Configure OpenCode for local source or package-based plugin loading.
 *
 * Example:
 * ```js
 * await configureOpenCodePluginSource("local", "/tmp/tui.json")
 * ```
 *
 * @param {"local" | "package"} source
 * @param {string} [configPath]
 */
export async function configureOpenCodePluginSource(source, configPath = DEFAULT_CONFIG_PATH) {
  return installOpenCodePlugin({ configPath, pluginEntry: resolvePluginEntry(source) })
}

/**
 * @param {string} raw
 * @param {string} configPath
 * @returns {Record<string, unknown>}
 */
function parseOpenCodeConfig(raw, configPath) {
  try {
    const parsed = JSON.parse(raw)
    if (isJsonObject(parsed)) return parsed
  } catch (error) {
    throw new Error(`Invalid JSON in '${configPath}'. Expected a JSON object. Cause: ${formatError(error)}`)
  }

  throw new Error(`Invalid OpenCode config in '${configPath}'. Expected top-level JSON object.`)
}

/**
 * @param {Record<string, unknown>} config
 * @param {string} configPath
 * @returns {string[]}
 */
function readPluginArray(config, configPath) {
  if (config.plugin === undefined) return []
  if (Array.isArray(config.plugin) && config.plugin.every((plugin) => typeof plugin === "string")) return config.plugin
  throw new Error(`Invalid plugin field in '${configPath}'. Expected an array of strings.`)
}

/**
 * @param {Record<string, unknown>} config
 */
function readSchema(config) {
  return typeof config.$schema === "string" ? config.$schema : DEFAULT_SCHEMA
}

/**
 * @param {string} configPath
 * @param {Record<string, unknown>} config
 */
async function writeOpenCodeConfig(configPath, config) {
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isJsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * @param {unknown} error
 * @param {string} code
 */
function hasErrorCode(error, code) {
  return isJsonObject(error) && error.code === code
}

/**
 * @param {string} targetPath
 */
async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false
    throw error
  }
}

/**
 * @param {unknown} error
 */
function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const command = argv[0] ?? "install"
  const rest = command === "install" || command === "uninstall" || command === "doctor" ? argv.slice(1) : argv
  return { command: normalizeCommand(command), ...parseOptions(rest) }
}

/**
 * @param {string} command
 */
function normalizeCommand(command) {
  if (["install", "uninstall", "doctor"].includes(command)) return command
  if (["local", "package"].includes(command)) return "install"
  throw new Error(`Unknown command '${command}'. Expected install, uninstall, or doctor.`)
}

/**
 * @param {string[]} argv
 */
function parseOptions(argv) {
  let configPath = DEFAULT_CONFIG_PATH
  let pluginEntry = PACKAGE_PLUGIN_SPEC

  for (let index = 0; index < argv.length; index += 1) {
    const next = readOption(argv, index, configPath, pluginEntry)
    ;({ configPath, pluginEntry } = next.options)
    index = next.index
  }

  return { configPath, pluginEntry }
}

/**
 * @param {string[]} argv
 * @param {number} index
 * @param {string} configPath
 * @param {string} pluginEntry
 */
function readOption(argv, index, configPath, pluginEntry) {
  const arg = argv[index]
  if (arg === "local" || arg === "package") return optionResult(index, configPath, resolvePluginEntry(arg))
  if (arg === "--config") return optionResult(index + 1, readRequiredPath(argv, index), pluginEntry)
  if (arg === "--plugin") return optionResult(index + 1, configPath, readRequiredValue(argv, index, "--plugin"))
  throw new Error(`Unknown argument '${arg}'. Expected --config, --plugin, local, or package.`)
}

/**
 * @param {number} index
 * @param {string} configPath
 * @param {string} pluginEntry
 */
function optionResult(index, configPath, pluginEntry) {
  return { index, options: { configPath, pluginEntry } }
}

/**
 * @param {string[]} argv
 * @param {number} index
 */
function readRequiredPath(argv, index) {
  return path.resolve(readRequiredValue(argv, index, "--config"))
}

/**
 * @param {string[]} argv
 * @param {number} index
 * @param {string} name
 */
function readRequiredValue(argv, index, name) {
  const value = argv[index + 1]
  if (!value) throw new Error(`Missing value after '${name}'. Expected a non-empty string.`)
  return value
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.command === "install") printInstall(await installOpenCodePlugin(args))
  if (args.command === "uninstall") printUninstall(await uninstallOpenCodePlugin(args))
  if (args.command === "doctor") printDoctor(await inspectOpenCodePlugin(args))
}

/**
 * @param {{ configPath: string, pluginEntry: string, changed: boolean }} result
 */
function printInstall(result) {
  console.log(result.changed ? "Installed OpenCode plugin." : "OpenCode plugin was already configured.")
  console.log(`Config: ${result.configPath}`)
  console.log(`Plugin: ${result.pluginEntry}`)
  console.log("Restart or reload OpenCode to apply the change.")
}

/**
 * @param {{ configPath: string, pluginEntry: string, changed: boolean }} result
 */
function printUninstall(result) {
  console.log(result.changed ? "Removed OpenCode plugin." : "OpenCode plugin was not configured.")
  console.log(`Config: ${result.configPath}`)
  console.log(`Plugin: ${result.pluginEntry}`)
}

/**
 * @param {{ configPath: string, pluginEntry: string, exists: boolean, configured: boolean }} result
 */
function printDoctor(result) {
  console.log(`Config: ${result.configPath}`)
  console.log(`Exists: ${result.exists ? "yes" : "no"}`)
  console.log(`Plugin: ${result.pluginEntry}`)
  console.log(`Configured: ${result.configured ? "yes" : "no"}`)
}

const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

if (isMainModule) {
  main().catch((error) => {
    console.error(formatError(error))
    console.error("Usage: opencode-chatgpt-usage-plugin [install|uninstall|doctor] [--config /path/to/tui.json] [--plugin spec]")
    process.exitCode = 1
  })
}
