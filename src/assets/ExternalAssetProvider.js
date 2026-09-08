/**
 * Placeholder for remote libraries (Sketchfab, Poly, etc.).
 */
export function createExternalAssetProvider() {
  return {
    id: 'external',
    async resolve() {
      return {
        status: 'unavailable',
        reason: 'External asset provider not configured.',
      }
    },
  }
}
