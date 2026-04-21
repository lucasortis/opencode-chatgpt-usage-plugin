import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_SCHEMA = "https://opencode.ai/tui.json"

export const PACKAGE_PLUGIN_SPEC = "@lucasortis/opencode-chatgpt-usage-plugin"
export const LOCAL_PLUGIN_PATH = path.resolve(fileURLToPath(new URL("../src/tui.tsx", import.meta.url)))
export const DEFAULT_CONFIG_PATH = path.join(homedir(), ".config", "opencode", "tui.json")

/**
 * @param {"local" | "package"} source
 */
export function resolvePluginEntry(source) {
  if (source === "local") return LOCAL_PLUGIN_PATH
  if (source === "package") return PACKAGE_PLUGIN_SPEC
  throw new Error(`Unknown plugin source: ${source}`)
}

/**
 * @param {string} configPath
 */
async function readConfig(configPath) {
  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("OpenCode config must be a JSON object.")
    }

    return parsed
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {}
    }

    throw error
  }
}

/**
 * @param {"local" | "package"} source
 * @param {string} [configPath]
 */
export async function switchOpenCodePluginSource(source, configPath = DEFAULT_CONFIG_PATH) {
  const pluginEntry = resolvePluginEntry(source)
  const existingConfig = await readConfig(configPath)

  const nextConfig = {
    ...existingConfig,
    $schema: typeof existingConfig.$schema === "string" ? existingConfig.$schema : DEFAULT_SCHEMA,
    plugin: [pluginEntry],
  }

  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8")

  return {
    configPath,
    pluginEntry,
  }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const [source, ...rest] = argv

  if (source !== "local" && source !== "package") {
    throw new Error("First argument must be 'local' or 'package'.")
  }

  let configPath = DEFAULT_CONFIG_PATH

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]

    if (arg === "--config") {
      const value = rest[index + 1]
      if (!value) throw new Error("Missing value after --config.")
      configPath = path.resolve(value)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { source, configPath }
}

async function main() {
  const { source, configPath } = parseArgs(process.argv.slice(2))
  const result = await switchOpenCodePluginSource(source, configPath)

  console.log(`Updated ${result.configPath}`)
  console.log(`Plugin source: ${source}`)
  console.log(`Plugin entry: ${result.pluginEntry}`)
  console.log("Restart or reload OpenCode to apply the change.")
}

const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    console.error("Usage: node ./scripts/set-opencode-plugin-source.mjs <local|package> [--config /path/to/tui.json]")
    process.exitCode = 1
  })
}
