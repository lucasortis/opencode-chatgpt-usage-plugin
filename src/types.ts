export interface RateLimitWindowSnapshotPayload {
  used_percent?: number | null
  reset_at?: number | null
}

export interface RateLimitStatusDetailsPayload {
  primary_window?: RateLimitWindowSnapshotPayload | null
  secondary_window?: RateLimitWindowSnapshotPayload | null
}

export interface CreditStatusDetailsPayload {
  has_credits?: boolean | null
  unlimited?: boolean | null
  balance?: number | null
}

export interface AdditionalRateLimitDetailsPayload {
  limit_name?: string | null
  metered_feature?: string | null
  rate_limit?: RateLimitStatusDetailsPayload | null
}

export interface ChatGptUsagePayload {
  plan_type?: string | null
  rate_limit?: RateLimitStatusDetailsPayload | null
  credits?: CreditStatusDetailsPayload | null
  additional_rate_limits?: AdditionalRateLimitDetailsPayload[] | null
  rate_limit_reached_type?: string | null
}

export interface UsageWindowSnapshot {
  usedPercent: number | null
  resetAt: number | null
}

export interface UsageRateLimitDetails {
  primaryWindow: UsageWindowSnapshot | null
  secondaryWindow: UsageWindowSnapshot | null
}

export interface UsageCreditDetails {
  hasCredits: boolean | null
  unlimited: boolean | null
  balance: number | null
}

export interface AdditionalUsageRateLimitDetails {
  limitName: string | null
  meteredFeature: string | null
  rateLimit: UsageRateLimitDetails | null
}

export interface UsageSnapshot {
  fetchedAt: number
  planType: string | null
  rateLimit: UsageRateLimitDetails | null
  credits: UsageCreditDetails | null
  additionalRateLimits: AdditionalUsageRateLimitDetails[]
  rateLimitReachedType: string | null
}

export interface UsageCacheRecord {
  version: 1
  snapshot: UsageSnapshot
}

export interface OpenCodeOAuthAuth {
  type: "oauth"
  refresh: string
  access: string
  expires: number
  accountId?: string
  enterpriseUrl?: string
}
