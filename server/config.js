import { createHash, randomUUID } from 'node:crypto'
import { DEFAULT_RATE_LIMITS, DEFAULT_WORLD_LIMITS } from '../src/world/limits.js'

function intEnv(env, name, fallback) {
  const raw = env[name]
  if (raw == null || raw === '') {
    return fallback
  }
  const value = Number.parseInt(String(raw), 10)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export const ENVIRONMENT_MODES = Object.freeze({
  IMAGE_GENERATION: 'IMAGE_GENERATION',
  PROCEDURAL_360: 'PROCEDURAL_360',
})

function environmentModeFromEnv(env) {
  const raw = String(env.ENVIRONMENT_MODE || env.PANORAMA_MODE || ENVIRONMENT_MODES.PROCEDURAL_360)
    .trim()
    .toUpperCase()
  if (raw === ENVIRONMENT_MODES.IMAGE_GENERATION || raw === 'IMAGE' || raw === 'PANORAMA') {
    return ENVIRONMENT_MODES.IMAGE_GENERATION
  }
  return ENVIRONMENT_MODES.PROCEDURAL_360
}

export function loadServerConfig(env = process.env) {
  const world = {
    maxRooms: intEnv(env, 'MAX_ROOMS', DEFAULT_WORLD_LIMITS.maxRooms),
    maxObjectsPerRoom: intEnv(env, 'MAX_OBJECTS_PER_ROOM', DEFAULT_WORLD_LIMITS.maxObjectsPerRoom),
    maxHotspotsPerRoom: intEnv(env, 'MAX_HOTSPOTS_PER_ROOM', DEFAULT_WORLD_LIMITS.maxHotspotsPerRoom),
    maxGeneratedAssetsPerWorld: intEnv(
      env,
      'MAX_GENERATED_ASSETS_PER_WORLD',
      DEFAULT_WORLD_LIMITS.maxGeneratedAssetsPerWorld
    ),
    maxPromptLength: intEnv(env, 'MAX_PROMPT_LENGTH', DEFAULT_WORLD_LIMITS.maxPromptLength),
    maxDescriptionLength: intEnv(env, 'MAX_DESCRIPTION_LENGTH', DEFAULT_WORLD_LIMITS.maxDescriptionLength),
    maxThemeLength: intEnv(env, 'MAX_THEME_LENGTH', DEFAULT_WORLD_LIMITS.maxThemeLength),
    maxRequestBodyBytes: intEnv(env, 'MAX_REQUEST_BODY_BYTES', DEFAULT_WORLD_LIMITS.maxRequestBodyBytes),
    maxTagsPerNeed: DEFAULT_WORLD_LIMITS.maxTagsPerNeed,
  }

  const anonymous = {
    worldPerMinute: intEnv(env, 'WORLD_RATE_LIMIT_PER_MINUTE', DEFAULT_RATE_LIMITS.worldPerMinute),
    worldPerTenMinutes: intEnv(env, 'WORLD_RATE_LIMIT_PER_10_MINUTES', DEFAULT_RATE_LIMITS.worldPerTenMinutes),
    worldPerHour: intEnv(env, 'WORLD_RATE_LIMIT_PER_HOUR', DEFAULT_RATE_LIMITS.worldPerHour),
    worldPerTenMinutesBudget: intEnv(
      env,
      'WORLD_RATE_LIMIT_BUDGET_PER_10_MINUTES',
      DEFAULT_RATE_LIMITS.worldPerTenMinutesBudget
    ),
    worldPerDay: intEnv(env, 'WORLD_RATE_LIMIT_PER_DAY', DEFAULT_RATE_LIMITS.worldPerDay),
    generationPerMinute: intEnv(env, 'GENERATION_RATE_LIMIT_PER_MINUTE', DEFAULT_RATE_LIMITS.generationPerMinute),
    generationPerDay: intEnv(env, 'GENERATION_RATE_LIMIT_PER_DAY', DEFAULT_RATE_LIMITS.generationPerDay),
  }

  const authenticated = {
    worldPerMinute: intEnv(env, 'AUTH_WORLD_RATE_LIMIT_PER_MINUTE', anonymous.worldPerMinute * 2),
    worldPerTenMinutes: intEnv(env, 'AUTH_WORLD_RATE_LIMIT_PER_10_MINUTES', anonymous.worldPerTenMinutes * 2),
    worldPerHour: intEnv(env, 'AUTH_WORLD_RATE_LIMIT_PER_HOUR', anonymous.worldPerHour * 2),
    worldPerTenMinutesBudget: intEnv(
      env,
      'AUTH_WORLD_RATE_LIMIT_BUDGET_PER_10_MINUTES',
      anonymous.worldPerTenMinutesBudget * 2
    ),
    worldPerDay: intEnv(env, 'AUTH_WORLD_RATE_LIMIT_PER_DAY', anonymous.worldPerDay * 2),
    generationPerMinute: intEnv(env, 'AUTH_GENERATION_RATE_LIMIT_PER_MINUTE', anonymous.generationPerMinute * 2),
    generationPerDay: intEnv(env, 'AUTH_GENERATION_RATE_LIMIT_PER_DAY', anonymous.generationPerDay * 2),
  }

  return {
    environmentMode: environmentModeFromEnv(env),
    llmApiKey: env.LLM_API_KEY || env.OPENAI_API_KEY || '',
    llmBaseUrl: env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: env.LLM_MODEL || 'gpt-4o-mini',
    llmTimeoutMs: intEnv(env, 'LLM_TIMEOUT_MS', 45_000),
    imageApiKey: env.IMAGE_API_KEY || env.LLM_API_KEY || env.OPENAI_API_KEY || '',
    imageBaseUrl: env.IMAGE_BASE_URL || env.LLM_BASE_URL || 'https://api.openai.com/v1',
    imageModel: env.IMAGE_MODEL || 'gpt-image-1',
    imageSize: env.IMAGE_SIZE || '1536x1024',
    imageQuality: env.IMAGE_QUALITY || 'high',
    imageGenerationCount: intEnv(env, 'IMAGE_GENERATION_COUNT', 1),
    imageTimeoutMs: intEnv(env, 'IMAGE_TIMEOUT_MS', 120_000),
    generatedAssetDir: env.GENERATED_ASSET_DIR || 'public/generated',
    redisUrl: env.REDIS_URL || '',
    world,
    rates: { anonymous, authenticated },
  }
}

export function worldRatePolicies(rates) {
  return [
    { name: 'world_per_minute', limit: rates.worldPerMinute, windowMs: 60_000 },
    { name: 'world_per_10m', limit: rates.worldPerTenMinutes, windowMs: 10 * 60_000 },
    { name: 'world_per_hour', limit: rates.worldPerHour, windowMs: 60 * 60_000 },
    { name: 'world_budget_10m', limit: rates.worldPerTenMinutesBudget, windowMs: 10 * 60_000 },
    { name: 'world_per_day', limit: rates.worldPerDay, windowMs: 24 * 60 * 60_000 },
  ].filter((policy) => policy.limit > 0)
}

export function generationRatePolicies(rates) {
  return [
    { name: 'generation_per_minute', limit: rates.generationPerMinute, windowMs: 60_000 },
    { name: 'generation_per_day', limit: rates.generationPerDay, windowMs: 24 * 60 * 60_000 },
  ].filter((policy) => policy.limit > 0)
}

export function hashPrompt(prompt) {
  return createHash('sha256').update(String(prompt)).digest('hex').slice(0, 12)
}

export function newRequestId(incoming) {
  const value = String(incoming ?? '').trim()
  if (/^[A-Za-z0-9._-]{8,128}$/.test(value)) {
    return value
  }
  return randomUUID()
}
