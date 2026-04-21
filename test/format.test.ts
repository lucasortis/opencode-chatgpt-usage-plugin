import assert from "node:assert/strict"
import test from "node:test"
import {
  formatPlanType,
  formatRemainingBar,
  formatRemainingPercent,
  formatResetAt,
  formatUsageLines,
  getRemainingPercent,
} from "../src/format.js"
import type { UsageSnapshot } from "../src/types.js"

test("formatPlanType normalizes plan names", () => {
  assert.equal(formatPlanType("pro_plus"), "Pro Plus")
  assert.equal(formatPlanType(null), "Unknown plan")
})

test("getRemainingPercent and formatRemainingPercent handle known and unknown usage", () => {
  assert.equal(getRemainingPercent({ usedPercent: 41.5, resetAt: 1_744_000_000 }), 58.5)
  assert.equal(getRemainingPercent({ usedPercent: null, resetAt: 1_744_000_000 }), null)
  assert.equal(formatRemainingPercent(41.5), "58.5% left")
  assert.equal(formatRemainingPercent(null), "Unknown usage")
})

test("formatRemainingBar renders a compact progress bar", () => {
  assert.equal(formatRemainingBar(25, 8), "██████░░")
  assert.equal(formatRemainingBar(100, 8), "░░░░░░░░")
  assert.equal(formatRemainingBar(null, 8), "░░░░░░░░")
})

test("formatResetAt returns a readable date when reset time is valid", () => {
  const formatted = formatResetAt(1_744_000_000)
  assert.notEqual(formatted, "unknown time")
})

test("formatUsageLines includes primary, secondary, and additional buckets", () => {
  const snapshot: UsageSnapshot = {
    fetchedAt: 1_744_000_000,
    planType: "pro",
    rateLimit: {
      primaryWindow: {
        usedPercent: 42,
        resetAt: 1_744_000_100,
      },
      secondaryWindow: {
        usedPercent: 55,
        resetAt: 1_744_000_200,
      },
    },
    credits: null,
    additionalRateLimits: [
      {
        limitName: "Image generation",
        meteredFeature: null,
        rateLimit: {
          primaryWindow: {
            usedPercent: 20,
            resetAt: 1_744_000_300,
          },
          secondaryWindow: null,
        },
      },
    ],
    rateLimitReachedType: "weekly",
  }

  const lines = formatUsageLines(snapshot)

  assert.equal(lines[0], "Plan: Pro")
  assert.match(lines[1] ?? "", /^5h limit: 58% left · resets /)
  assert.match(lines[2] ?? "", /^Weekly limit: 45% left · resets /)
  assert.match(lines[3] ?? "", /^Image generation: 80% left · resets /)
  assert.equal(lines[4], "Reached bucket: weekly")
})
