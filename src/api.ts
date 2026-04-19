import { homedir } from "node:os"
import path from "node:path"
import { readFile } from "node:fs/promises"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type {
  AdditionalUsageRateLimitDetails,
  OpenCodeOAuthAuth,
  UsageCacheRecord,
  UsageCreditDetails,
  UsageRateLimitDetails,
  UsageSnapshot,
  UsageWindowSnapshot,
} from "./types.js"

export const CHATGPT_USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage"
const OPENAI_OAUTH_ISSUER = "https://auth.openai.com"
const OPENAI_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
export const GPT_USAGE_TOKEN_ENV = "GPT_USAGE_TOKEN"
export const GPT_USAGE_ACCOUNT_ID_ENV = "GPT_USAGE_ACCOUNT_ID"

export function getUsageCacheKey(pluginID: string): string {
  return `${pluginID}.usage-cache`
}

export function readUsageCache(value: unknown): UsageCacheRecord | undefined {
  const objectValue = asObject(value)
  if (!objectValue || objectValue.version !== 1) return undefined
  const snapshot = parseStoredSnapshot(objectValue.snapshot)
  if (!snapshot) return undefined
  return {
    version: 1,
    snapshot,
  }
}

export function createUsageCacheRecord(snapshot: UsageSnapshot): UsageCacheRecord {
  return {
    version: 1,
    snapshot,
  }
}

export async function fetchUsageSnapshot(api: TuiPluginApi, signal?: AbortSignal): Promise<UsageSnapshot> {
  const auth = await resolveUsageAuth(api, signal)

  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
  })

  if (auth.accountId) {
    headers.set("ChatGPT-Account-Id", auth.accountId)
  }

  const response = await fetch(CHATGPT_USAGE_ENDPOINT, {
    method: "GET",
    headers,
    ...(signal ? { signal } : {}),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, bodyText))
  }

  let payload: unknown
  try {
    payload = bodyText ? JSON.parse(bodyText) : null
  } catch {
    throw new Error("ChatGPT usage endpoint returned invalid JSON.")
  }

  return parseUsagePayload(payload)
}

function parseUsagePayload(value: unknown): UsageSnapshot {
  const objectValue = asObject(value)
  if (!objectValue) {
    throw new Error("ChatGPT usage endpoint returned an unexpected response.")
  }

  return {
    fetchedAt: unixNow(),
    planType: asNullableString(objectValue.plan_type),
    rateLimit: parseRateLimitDetails(objectValue.rate_limit),
    credits: parseCreditDetails(objectValue.credits),
    additionalRateLimits: parseAdditionalRateLimits(objectValue.additional_rate_limits),
    rateLimitReachedType: asNullableString(objectValue.rate_limit_reached_type),
  }
}

function parseStoredSnapshot(value: unknown): UsageSnapshot | undefined {
  const objectValue = asObject(value)
  if (!objectValue) return undefined

  const fetchedAt = asNullableNumber(objectValue.fetchedAt)
  if (fetchedAt === null) return undefined

  return {
    fetchedAt,
    planType: asNullableString(objectValue.planType),
    rateLimit: parseStoredRateLimitDetails(objectValue.rateLimit),
    credits: parseStoredCreditDetails(objectValue.credits),
    additionalRateLimits: parseStoredAdditionalRateLimits(objectValue.additionalRateLimits),
    rateLimitReachedType: asNullableString(objectValue.rateLimitReachedType),
  }
}

function parseRateLimitDetails(value: unknown): UsageRateLimitDetails | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const primaryWindow = parseWindowSnapshot(objectValue.primary_window)
  const secondaryWindow = parseWindowSnapshot(objectValue.secondary_window)
  if (!primaryWindow && !secondaryWindow) return null

  return {
    primaryWindow,
    secondaryWindow,
  }
}

function parseStoredRateLimitDetails(value: unknown): UsageRateLimitDetails | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const primaryWindow = parseStoredWindowSnapshot(objectValue.primaryWindow)
  const secondaryWindow = parseStoredWindowSnapshot(objectValue.secondaryWindow)
  if (!primaryWindow && !secondaryWindow) return null

  return {
    primaryWindow,
    secondaryWindow,
  }
}

function parseCreditDetails(value: unknown): UsageCreditDetails | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const hasCredits = asNullableBoolean(objectValue.has_credits)
  const unlimited = asNullableBoolean(objectValue.unlimited)
  const balance = asNullableNumber(objectValue.balance)
  if (hasCredits === null && unlimited === null && balance === null) return null

  return {
    hasCredits,
    unlimited,
    balance,
  }
}

function parseStoredCreditDetails(value: unknown): UsageCreditDetails | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const hasCredits = asNullableBoolean(objectValue.hasCredits)
  const unlimited = asNullableBoolean(objectValue.unlimited)
  const balance = asNullableNumber(objectValue.balance)
  if (hasCredits === null && unlimited === null && balance === null) return null

  return {
    hasCredits,
    unlimited,
    balance,
  }
}

function parseAdditionalRateLimits(value: unknown): AdditionalUsageRateLimitDetails[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const objectValue = asObject(entry)
    if (!objectValue) return []

    return [
      {
        limitName: asNullableString(objectValue.limit_name),
        meteredFeature: asNullableString(objectValue.metered_feature),
        rateLimit: parseRateLimitDetails(objectValue.rate_limit),
      },
    ]
  })
}

function parseStoredAdditionalRateLimits(value: unknown): AdditionalUsageRateLimitDetails[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const objectValue = asObject(entry)
    if (!objectValue) return []

    return [
      {
        limitName: asNullableString(objectValue.limitName),
        meteredFeature: asNullableString(objectValue.meteredFeature),
        rateLimit: parseStoredRateLimitDetails(objectValue.rateLimit),
      },
    ]
  })
}

function parseWindowSnapshot(value: unknown): UsageWindowSnapshot | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const usedPercent = asNullableNumber(objectValue.used_percent)
  const resetAt = asNullableNumber(objectValue.reset_at)
  if (usedPercent === null && resetAt === null) return null

  return {
    usedPercent,
    resetAt,
  }
}

function parseStoredWindowSnapshot(value: unknown): UsageWindowSnapshot | null {
  const objectValue = asObject(value)
  if (!objectValue) return null

  const usedPercent = asNullableNumber(objectValue.usedPercent)
  const resetAt = asNullableNumber(objectValue.resetAt)
  if (usedPercent === null && resetAt === null) return null

  return {
    usedPercent,
    resetAt,
  }
}

async function resolveUsageAuth(
  api: TuiPluginApi,
  signal?: AbortSignal,
): Promise<{ accessToken: string; accountId?: string }> {
  const tokenOverride = readOptionalEnv(GPT_USAGE_TOKEN_ENV)
  if (tokenOverride) {
    const accountIdOverride = readOptionalEnv(GPT_USAGE_ACCOUNT_ID_ENV)
    return {
      accessToken: tokenOverride,
      ...(accountIdOverride ? { accountId: accountIdOverride } : {}),
    }
  }

  const storedAuth = await readStoredOpenAIOAuth()
  if (!storedAuth) {
    throw new Error(
      "No logged-in OpenAI session found. Sign in to OpenCode with the OpenAI/ChatGPT provider, or set GPT_USAGE_TOKEN as an override.",
    )
  }

  const currentAuth = await refreshOpenAIOAuthIfNeeded(api, storedAuth, signal)
  return {
    accessToken: currentAuth.access,
    ...(currentAuth.accountId ? { accountId: currentAuth.accountId } : {}),
  }
}

async function readStoredOpenAIOAuth(): Promise<OpenCodeOAuthAuth | undefined> {
  const envContent = readOptionalEnv("OPENCODE_AUTH_CONTENT")
  if (envContent) {
    const parsed = parseAuthRecord(envContent)
    const auth = parseOpenAIOAuthEntry(parsed)
    if (auth) return auth
  }

  for (const authPath of resolveOpenCodeAuthPaths()) {
    try {
      const fileContent = await readFile(authPath, "utf8")
      const parsed = parseAuthRecord(fileContent)
      const auth = parseOpenAIOAuthEntry(parsed)
      if (auth) return auth
    } catch {
      continue
    }
  }

  return undefined
}

async function refreshOpenAIOAuthIfNeeded(
  api: TuiPluginApi,
  auth: OpenCodeOAuthAuth,
  signal?: AbortSignal,
): Promise<OpenCodeOAuthAuth> {
  if (auth.access.trim() && auth.expires > Date.now() + 30_000) {
    return auth
  }

  const tokens = await refreshOpenAIOAuth(auth.refresh, signal)
  const accountId = extractAccountId(tokens) ?? auth.accountId
  const nextAuth: OpenCodeOAuthAuth = {
    type: "oauth",
    refresh: tokens.refresh_token,
    access: tokens.access_token,
    expires: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    ...(accountId ? { accountId } : {}),
    ...(auth.enterpriseUrl ? { enterpriseUrl: auth.enterpriseUrl } : {}),
  }

  await api.client.auth.set({
    providerID: "openai",
    auth: nextAuth,
  })

  return nextAuth
}

async function refreshOpenAIOAuth(
  refreshToken: string,
  signal?: AbortSignal,
): Promise<OpenAITokenResponse> {
  const response = await fetch(`${OPENAI_OAUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OPENAI_OAUTH_CLIENT_ID,
    }).toString(),
    ...(signal ? { signal } : {}),
  })

  if (!response.ok) {
    throw new Error(`OpenCode OpenAI session refresh failed (${response.status}). Please reconnect the OpenAI provider in OpenCode.`)
  }

  return response.json() as Promise<OpenAITokenResponse>
}

function parseAuthRecord(content: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(content) as unknown
    return asObject(parsed)
  } catch {
    return undefined
  }
}

function parseOpenAIOAuthEntry(record: Record<string, unknown> | undefined): OpenCodeOAuthAuth | undefined {
  const auth = record?.openai
  const objectValue = asObject(auth)
  if (!objectValue) return undefined
  if (objectValue.type !== "oauth") return undefined

  const refresh = asNullableString(objectValue.refresh)
  const access = asNullableString(objectValue.access)
  const expires = asNullableNumber(objectValue.expires)
  const accountId = asNullableString(objectValue.accountId)
  const enterpriseUrl = asNullableString(objectValue.enterpriseUrl)
  if (!refresh || !access || expires === null) return undefined

  return {
    type: "oauth",
    refresh,
    access,
    expires,
    ...(accountId ? { accountId } : {}),
    ...(enterpriseUrl ? { enterpriseUrl } : {}),
  }
}

function resolveOpenCodeAuthPaths(): string[] {
  const envDataHome = readOptionalEnv("XDG_DATA_HOME")
  if (envDataHome) {
    return [path.join(envDataHome, "opencode", "auth.json")]
  }

  const home = homedir()
  switch (process.platform) {
    case "darwin":
      return [
        path.join(home, ".local", "share", "opencode", "auth.json"),
        path.join(home, "Library", "Application Support", "opencode", "auth.json"),
      ]
    case "win32": {
      const localAppData = readOptionalEnv("LOCALAPPDATA")
      const appData = readOptionalEnv("APPDATA")
      const base = localAppData ?? appData ?? path.join(home, "AppData", "Local")
      return [path.join(base, "opencode", "auth.json")]
    }
    default:
      return [path.join(home, ".local", "share", "opencode", "auth.json")]
  }
}

type OpenAIJwtClaims = {
  chatgpt_account_id?: string
  organizations?: Array<{ id?: string }>
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string
  }
}

type OpenAITokenResponse = {
  id_token?: string
  access_token: string
  refresh_token: string
  expires_in?: number
}

function extractAccountId(tokens: OpenAITokenResponse): string | undefined {
  const fromIdToken = tokens.id_token ? extractAccountIdFromToken(tokens.id_token) : undefined
  if (fromIdToken) return fromIdToken
  return extractAccountIdFromToken(tokens.access_token)
}

function extractAccountIdFromToken(token: string): string | undefined {
  const claims = parseJwtClaims(token)
  if (!claims) return undefined
  return (
    claims.chatgpt_account_id ||
    claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

function parseJwtClaims(token: string): OpenAIJwtClaims | undefined {
  const parts = token.split(".")
  if (parts.length !== 3) return undefined
  const payload = parts[1]
  if (!payload) return undefined

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as OpenAIJwtClaims
  } catch {
    return undefined
  }
}

function readOptionalEnv(name: string): string | undefined {
  const processValue = readProcessObject()
  const value = processValue?.env?.[name]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readProcessObject(): { env?: Record<string, string | undefined> } | undefined {
  if (!("process" in globalThis)) return undefined
  const processValue = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }).process

  return processValue
}

function describeHttpError(status: number, bodyText: string): string {
  const detail = extractErrorDetail(bodyText)
  const suffix = detail ? ` ${detail}` : ""

  if (status === 401 || status === 403) {
    return `ChatGPT authentication failed (${status}). Your ${GPT_USAGE_TOKEN_ENV} may be expired or invalid.${suffix}`
  }

  if (status === 429) {
    return `ChatGPT usage endpoint is rate limited (${status}). Please try again shortly.${suffix}`
  }

  return `ChatGPT usage request failed with HTTP ${status}.${suffix}`
}

function extractErrorDetail(bodyText: string): string | undefined {
  const trimmed = bodyText.trim()
  if (!trimmed) return undefined

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const objectValue = asObject(parsed)
    if (!objectValue) return truncate(trimmed)

    const detail = asNullableString(objectValue.detail)
      ?? asNullableString(objectValue.message)
      ?? asNullableString(objectValue.error)

    if (detail) return truncate(detail)
    return truncate(trimmed)
  } catch {
    return truncate(trimmed)
  }
}

function truncate(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return Object.fromEntries(Object.entries(value))
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function asNullableBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null
  return value
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000)
}
