/**
 * Per-request cap on expensive generation provider calls.
 * Cache hits and catalog matches must not consume this budget.
 */
export function createGenerationBudget({
  requestId,
  userKey,
  maxGeneratedAssets,
} = {}) {
  const max = Math.max(0, Number(maxGeneratedAssets) || 0)
  let generatedAssets = 0

  return {
    requestId: requestId ?? null,
    userKey: userKey ?? null,
    maxGeneratedAssets: max,
    get generatedAssets() {
      return generatedAssets
    },
    get remaining() {
      return Math.max(0, max - generatedAssets)
    },
    canGenerate() {
      return generatedAssets < max
    },
    consume() {
      if (!this.canGenerate()) {
        return false
      }
      generatedAssets += 1
      return true
    },
    snapshot() {
      return {
        requestId: this.requestId,
        userKey: this.userKey,
        maxGeneratedAssets: max,
        generatedAssets,
        remaining: this.remaining,
      }
    },
  }
}
