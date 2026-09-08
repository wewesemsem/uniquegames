/**
 * Cheap provider: previously generated panoramas on disk.
 * Does not consume the generation budget.
 */
export function createGeneratedDiskCacheProvider(store) {
  return {
    id: 'generated-cache',
    expensive: false,
    async resolve(request) {
      if (!store || request.kind !== 'panorama') {
        return { status: 'unavailable', reason: 'No generated cache.' }
      }
      const asset = store.get(request)
      if (!asset) {
        return { status: 'unavailable', reason: 'Not in generated cache.' }
      }
      return { status: 'resolved', asset }
    },
  }
}
