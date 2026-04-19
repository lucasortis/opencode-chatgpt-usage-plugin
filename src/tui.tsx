/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import {
  createUsageCacheRecord,
  fetchUsageSnapshot,
  getUsageCacheKey,
  readUsageCache,
} from "./api.js"
import {
  formatPlanType,
  formatRemainingPercent,
  formatResetAt,
  formatSnapshotTime,
  formatUsageLines,
  getRemainingPercent,
} from "./format.js"
import type { UsageSnapshot, UsageWindowSnapshot } from "./types.js"

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
  const theme = props.api.theme.current
  const statusColor = pickStatusColor(props.api, props.state)
  const snapshot = props.state.snapshot
  const primaryWindow = snapshot?.rateLimit?.primaryWindow
  const secondaryWindow = snapshot?.rateLimit?.secondaryWindow
  const additionalRateLimits = snapshot?.additionalRateLimits ?? []

  return (
    <box flexDirection="column" gap={1} paddingLeft={2} paddingRight={2} paddingBottom={1} width="100%" alignItems="center">
      <box flexDirection="column" gap={1} width="100%" maxWidth={72}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text}>
            <b>ChatGPT usage</b>
          </text>

          <text fg={theme.textMuted} onMouseUp={props.onClose}>
            esc
          </text>
        </box>

        <box border borderColor={theme.borderActive} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="column" gap={1}>
          <text fg={theme.primary}>
            <b>{formatPlanType(snapshot?.planType ?? null)}</b>
          </text>

          <text fg={statusColor} wrapMode="word">
            {formatStatusLine(props.state)}
          </text>

          {props.state.error ? (
            <text fg={theme.error} wrapMode="word">
              {props.state.error}
            </text>
          ) : null}

          {snapshot ? (
            <box flexDirection="column" gap={1} paddingTop={1}>
              {primaryWindow ? <UsageRow api={props.api} label="5h limit" window={primaryWindow} /> : null}
              {secondaryWindow ? <UsageRow api={props.api} label="Weekly limit" window={secondaryWindow} /> : null}
            </box>
          ) : (
            <box flexDirection="column" gap={1} paddingTop={1}>
              <text fg={theme.textMuted}>No cached usage snapshot yet.</text>
              <text fg={theme.textMuted} wrapMode="word">
                Run /gpt-usage again anytime to refresh your current ChatGPT limits.
              </text>
            </box>
          )}
        </box>

        {additionalRateLimits.length > 0 ? (
          <box border borderColor={theme.border} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="column" gap={1}>
            <text fg={theme.text}>
              <b>Additional limits</b>
            </text>

            {additionalRateLimits.map((limit) => {
              const label = limit.limitName ?? limit.meteredFeature ?? "Additional limit"

              return (
                <box flexDirection="column" gap={1}>
                  {limit.rateLimit?.primaryWindow ? (
                    <UsageRow
                      api={props.api}
                      label={limit.rateLimit.secondaryWindow ? `${label} (primary)` : label}
                      window={limit.rateLimit.primaryWindow}
                    />
                  ) : null}

                  {limit.rateLimit?.secondaryWindow ? (
                    <UsageRow api={props.api} label={`${label} (secondary)`} window={limit.rateLimit.secondaryWindow} />
                  ) : null}
                </box>
              )
            })}
          </box>
        ) : null}

        {snapshot?.rateLimitReachedType ? (
          <text fg={theme.textMuted}>Reached bucket: {snapshot.rateLimitReachedType}</text>
        ) : null}
      </box>
    </box>
  )
}

function UsageRow(props: { api: TuiPluginApi; label: string; window: UsageWindowSnapshot }) {
  const theme = props.api.theme.current
  const remaining = getRemainingPercent(props.window)

  return (
    <box flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted}>{props.label}</text>

        <text fg={pickRemainingColor(props.api, remaining)}>
          <b>{formatRemainingPercent(props.window.usedPercent)}</b>
        </text>
      </box>

      <text fg={theme.textMuted}>resets {formatResetAt(props.window.resetAt)}</text>
    </box>
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
  if (!snapshot) return "large"
  const lineCount = formatUsageLines(snapshot).length
  return lineCount > 4 ? "large" : "medium"
}

function pickRemainingColor(api: TuiPluginApi, remaining: number | null) {
  if (remaining === null) return api.theme.current.text
  if (remaining <= 20) return api.theme.current.error
  if (remaining <= 50) return api.theme.current.warning
  return api.theme.current.success
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Failed to load ChatGPT usage."
}

export default {
  id: pluginID,
  tui,
} satisfies TuiPluginModule & { id: string }
