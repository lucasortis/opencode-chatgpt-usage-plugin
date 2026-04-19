/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import {
  createUsageCacheRecord,
  fetchUsageSnapshot,
  getUsageCacheKey,
  GPT_USAGE_ACCOUNT_ID_ENV,
  GPT_USAGE_TOKEN_ENV,
  readUsageCache,
} from "./api.js"
import { formatSnapshotTime, formatUsageLines } from "./format.js"
import type { UsageSnapshot } from "./types.js"

const pluginID = "lucas.gpt-usage"
const commandValue = "lucas.gpt-usage.open"

let activeRequestID = 0
let activeRequestController: AbortController | undefined

type UsageDialogState = {
  snapshot: UsageSnapshot | undefined
  source: "cached" | "fresh" | "none"
  phase: "loading" | "ready" | "error"
  error: string | undefined
}

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: "GPT usage",
      value: commandValue,
      description: "Show ChatGPT plan usage limits",
      category: "Plugin",
      slash: {
        name: "gpt-usage",
        aliases: ["usage"],
      },
      onSelect: () => {
        void openUsageDialog(api)
      },
    },
  ])
}

async function openUsageDialog(api: TuiPluginApi): Promise<void> {
  activeRequestID += 1
  const requestID = activeRequestID

  activeRequestController?.abort()
  const requestController = new AbortController()
  activeRequestController = requestController

  let closed = false

  const release = () => {
    if (closed) return
    closed = true
    requestController.abort()
    if (activeRequestController === requestController) {
      activeRequestController = undefined
    }
  }

  const dismiss = () => {
    release()
    api.ui.dialog.clear()
  }

  const render = (state: UsageDialogState) => {
    if (closed || requestController.signal.aborted || requestID !== activeRequestID) return

    api.ui.dialog.setSize(selectDialogSize(state.snapshot))
    api.ui.dialog.replace(() => <UsageDialog api={api} state={state} onClose={dismiss} />, release)
  }

  const cachedSnapshot = api.kv.ready ? readUsageCache(api.kv.get(getUsageCacheKey(pluginID)))?.snapshot : undefined

  render(
    cachedSnapshot
      ? {
          snapshot: cachedSnapshot,
          source: "cached",
          phase: "loading",
          error: undefined,
        }
      : {
          snapshot: undefined,
          source: "none",
          phase: "loading",
          error: undefined,
        },
  )

  try {
    const signal = AbortSignal.any([api.lifecycle.signal, requestController.signal])
    const snapshot = await fetchUsageSnapshot(api, signal)
    api.kv.set(getUsageCacheKey(pluginID), createUsageCacheRecord(snapshot))
    render({
      snapshot,
      source: "fresh",
      phase: "ready",
      error: undefined,
    })
  } catch (error) {
    if (requestController.signal.aborted || api.lifecycle.signal.aborted) return

    render({
      snapshot: cachedSnapshot,
      source: cachedSnapshot ? "cached" : "none",
      phase: "error",
      error: toMessage(error),
    })
  }
}

function UsageDialog(props: { api: TuiPluginApi; state: UsageDialogState; onClose: () => void }) {
  const Dialog = props.api.ui.Dialog
  const theme = props.api.theme.current
  const lines = props.state.snapshot ? formatUsageLines(props.state.snapshot) : []
  const statusColor = pickStatusColor(props.api, props.state)

  return (
    <Dialog size={selectDialogSize(props.state.snapshot)} onClose={props.onClose}>
      <box flexDirection="column" gap={1} paddingLeft={2} paddingRight={2} paddingBottom={1} width="100%">
        <text fg={theme.text}>
          <b>ChatGPT usage</b>
        </text>

        <text fg={statusColor}>{formatStatusLine(props.state)}</text>

        {props.state.error ? <text fg={theme.error}>{props.state.error}</text> : null}

        {lines.length > 0 ? (
          <box
            border
            borderColor={theme.border}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            flexDirection="column"
            gap={1}
          >
            {lines.map((line) => (
              <text fg={theme.text}>{line}</text>
            ))}
          </box>
        ) : (
          <box
            border
            borderColor={theme.border}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            flexDirection="column"
            gap={1}
          >
            <text fg={theme.textMuted}>No cached usage snapshot yet.</text>
            <text fg={theme.textMuted}>A live refresh is attempted whenever you run /gpt-usage.</text>
          </box>
        )}

        <text fg={theme.textMuted}>Uses your existing OpenCode OpenAI login. Env overrides are optional.</text>

        <text fg={theme.textMuted}>
          Optional overrides: {GPT_USAGE_TOKEN_ENV} · {GPT_USAGE_ACCOUNT_ID_ENV}
        </text>
      </box>
    </Dialog>
  )
}

function formatStatusLine(state: UsageDialogState): string {
  if (state.phase === "ready" && state.snapshot) {
    return `Updated from ChatGPT at ${formatSnapshotTime(state.snapshot.fetchedAt)}.`
  }

  if (state.phase === "loading" && state.snapshot) {
    return `Showing cached snapshot from ${formatSnapshotTime(state.snapshot.fetchedAt)} while refreshing…`
  }

  if (state.phase === "loading") {
    return "Fetching current usage from ChatGPT…"
  }

  if (state.snapshot) {
    return `Refresh failed. Showing cached snapshot from ${formatSnapshotTime(state.snapshot.fetchedAt)}.`
  }

  return "Unable to load usage data."
}

function pickStatusColor(api: TuiPluginApi, state: UsageDialogState) {
  if (state.phase === "ready") return api.theme.current.success
  if (state.phase === "loading") return api.theme.current.info
  return state.snapshot ? api.theme.current.warning : api.theme.current.error
}

function selectDialogSize(snapshot?: UsageSnapshot): "medium" | "large" {
  if (!snapshot) return "medium"
  const lineCount = formatUsageLines(snapshot).length
  return lineCount > 6 ? "large" : "medium"
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Failed to load ChatGPT usage."
}

export default {
  id: pluginID,
  tui,
} satisfies TuiPluginModule & { id: string }
