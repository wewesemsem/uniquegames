/**
 * AssetProvider interface.
 *
 * resolve(request) →
 *   { status: 'resolved', asset }
 *   { status: 'unavailable', reason }
 *
 * Providers must not invent renderer-side code. They only return asset
 * descriptors the AssetResolver can attach to World State.
 */
export function createAsset(partial) {
  return {
    id: partial.id,
    kind: partial.kind,
    source: partial.source,
    url: partial.url ?? null,
    primitive: partial.primitive ?? null,
    color: partial.color ?? null,
    description: partial.description ?? '',
  }
}
