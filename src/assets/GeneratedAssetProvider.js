/**
 * Stub generation provider. Does not fake success.
 * Swap this for a real panorama/model generator later.
 * Marked expensive so the resolver applies generation budget + rate limits
 * before calling it.
 */
export function createGeneratedAssetProvider() {
  return {
    id: 'generated',
    expensive: true,
    configured: false,
    async resolve() {
      return {
        status: 'unavailable',
        reason: 'Generation provider not configured.',
      }
    },
  }
}
