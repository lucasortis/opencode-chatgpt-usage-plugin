import type { AdditionalUsageRateLimitDetails, UsageSnapshot, UsageWindowSnapshot } from "./types.js"

const resetFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatUsageLines(snapshot: UsageSnapshot): string[] {
  const lines: string[] = []

  lines.push(`Plan: ${formatPlanType(snapshot.planType)}`)

  const primaryWindow = snapshot.rateLimit?.primaryWindow
  if (primaryWindow) {
    lines.push(`5h limit: ${formatUsageWindow(primaryWindow)}`)
  }

  const secondaryWindow = snapshot.rateLimit?.secondaryWindow
  if (secondaryWindow) {
    lines.push(`Weekly limit: ${formatUsageWindow(secondaryWindow)}`)
  }

  for (const extraLine of formatAdditionalRateLimitLines(snapshot.additionalRateLimits)) {
    lines.push(extraLine)
  }

  if (snapshot.rateLimitReachedType) {
    lines.push(`Reached bucket: ${snapshot.rateLimitReachedType}`)
  }

  return lines
}

export function formatUsageWindow(window: UsageWindowSnapshot): string {
  const remaining = formatRemainingPercent(window.usedPercent)
  const reset = formatResetAt(window.resetAt)
  return `${remaining} · resets ${reset}`
}

export function formatSnapshotTime(unixSeconds: number): string {
  return formatResetAt(unixSeconds)
}

export function formatPlanType(planType: string | null): string {
  if (!planType) return "Unknown plan"

  return planType
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function getRemainingPercent(window: UsageWindowSnapshot): number | null {
  if (window.usedPercent === null) return null
  return clamp(100 - window.usedPercent, 0, 100)
}

export function formatRemainingPercent(usedPercent: number | null): string {
  if (usedPercent === null) return "Unknown usage"
  const remaining = clamp(100 - usedPercent, 0, 100)
  const rounded = Number.isInteger(remaining) ? remaining.toFixed(0) : remaining.toFixed(1)
  return `${rounded}% left`
}

export function formatResetAt(unixSeconds: number | null): string {
  if (unixSeconds === null) return "unknown time"
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) return "unknown time"
  return resetFormatter.format(date)
}

function formatAdditionalRateLimitLines(limits: AdditionalUsageRateLimitDetails[]): string[] {
  const lines: string[] = []

  for (const limit of limits) {
    const label = limit.limitName ?? limit.meteredFeature ?? "Additional limit"
    const primaryWindow = limit.rateLimit?.primaryWindow
    const secondaryWindow = limit.rateLimit?.secondaryWindow

    if (primaryWindow) {
      lines.push(`${label}${secondaryWindow ? " (primary)" : ""}: ${formatUsageWindow(primaryWindow)}`)
    }

    if (secondaryWindow) {
      lines.push(`${label} (secondary): ${formatUsageWindow(secondaryWindow)}`)
    }
  }

  return lines
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
