/**
 * Default world and rate-limit policy.
 * Server config overlays these from environment variables.
 */
export const DEFAULT_WORLD_LIMITS = {
  maxRooms: 3,
  maxObjectsPerRoom: 20,
  maxHotspotsPerRoom: 10,
  maxInteractionsPerRoom: 24,
  maxGeneratedAssetsPerWorld: 10,
  maxPromptLength: 1000,
  maxDescriptionLength: 240,
  maxThemeLength: 80,
  maxRequestBodyBytes: 8192,
  maxTagsPerNeed: 12,
}

export const DEFAULT_RATE_LIMITS = {
  worldPerMinute: 10,
  worldPerTenMinutes: 30,
  worldPerHour: 100,
  worldPerTenMinutesBudget: 5,
  worldPerDay: 20,
  generationPerMinute: 5,
  generationPerDay: 20,
}
