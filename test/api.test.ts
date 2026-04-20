import assert from "node:assert/strict"
import test from "node:test"
import { createUsageCacheRecord, getUsageCacheKey, readUsageCache } from "../src/api.js"
import type { UsageSnapshot } from "../src/types.js"

const snapshot: UsageSnapshot = {
  fetchedAt: 1_744_000_000,
  planType: "pro",
  rateLimit: {
    primaryWindow: {
      usedPercent: 42,
      resetAt: 1_744_000_100,
    },
    secondaryWindow: null,
  },
  credits: {
    hasCredits: true,
    unlimited: false,
    balance: 12,
  },
  additionalRateLimits: [],
  rateLimitReachedType: null,
}

test("getUsageCacheKey namespaces the plugin key", () => {
  assert.equal(getUsageCacheKey("lucas.gpt-usage"), "lucas.gpt-usage.usage-cache")
})

test("createUsageCacheRecord and readUsageCache round-trip a valid snapshot", () => {
  const record = createUsageCacheRecord(snapshot)
  assert.deepEqual(readUsageCache(record), record)
})

test("readUsageCache rejects invalid payloads", () => {
  assert.equal(readUsageCache(null), undefined)
  assert.equal(readUsageCache({ version: 2, snapshot }), undefined)
  assert.equal(readUsageCache({ version: 1, snapshot: null }), undefined)
})
