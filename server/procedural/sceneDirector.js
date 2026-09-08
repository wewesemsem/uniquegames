import { extractJsonObject } from '../../src/world/WorldSpecification.js'
import {
  COLOR_MOODS,
  DEFAULT_SCENE_CONFIGURATION,
  EFFECT_TYPES,
  ENVIRONMENT_TYPES,
  GROUND_TYPES,
  LIGHTING_STYLES,
  PARTICLE_TYPES,
  RoomSceneMapSchema,
  SKY_TYPES,
  STRUCTURE_TYPES,
  TERRAIN_TYPES,
  TIME_OF_DAY,
  parseSceneConfiguration,
  sceneFromDescription,
} from '../../src/world/SceneConfiguration.js'
import { fetchWithRetry } from '../ai/http.js'

function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }
  return `${trimmed}/chat/completions`
}

function pickEnum(value, allowed, fallback) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (allowed.includes(text)) {
    return text
  }
  const fuzzy = allowed.find((item) => text.includes(item) || item.includes(text))
  return fuzzy ?? fallback
}

function sanitizeScene(raw, fallback) {
  if (!raw || typeof raw !== 'object') {
    return fallback
  }
  const candidate = {
    ...fallback,
    environment: pickEnum(raw.environment, ENVIRONMENT_TYPES, fallback.environment),
    timeOfDay: pickEnum(raw.timeOfDay, TIME_OF_DAY, fallback.timeOfDay),
    sky: pickEnum(raw.sky, SKY_TYPES, fallback.sky),
    ground: pickEnum(raw.ground, GROUND_TYPES, fallback.ground),
    terrain: pickEnum(raw.terrain, TERRAIN_TYPES, fallback.terrain),
    fog: typeof raw.fog === 'number' ? Math.min(1, Math.max(0, raw.fog)) : fallback.fog,
    treeDensity:
      typeof raw.treeDensity === 'number' ? Math.min(1, Math.max(0, raw.treeDensity)) : fallback.treeDensity,
    lighting: typeof raw.lighting === 'number' ? Math.min(1, Math.max(0, raw.lighting)) : fallback.lighting,
    lightingStyle: pickEnum(raw.lightingStyle, LIGHTING_STYLES, fallback.lightingStyle),
    wind: typeof raw.wind === 'number' ? Math.min(1, Math.max(0, raw.wind)) : fallback.wind,
    particles: pickEnum(raw.particles, PARTICLE_TYPES, fallback.particles),
    colorMood: pickEnum(raw.colorMood, COLOR_MOODS, fallback.colorMood),
    starDensity:
      typeof raw.starDensity === 'number' ? Math.min(1, Math.max(0, raw.starDensity)) : fallback.starDensity,
    planetCount:
      typeof raw.planetCount === 'number'
        ? Math.min(6, Math.max(0, Math.round(raw.planetCount)))
        : fallback.planetCount,
    nebula: typeof raw.nebula === 'number' ? Math.min(1, Math.max(0, raw.nebula)) : fallback.nebula,
    structures: Array.isArray(raw.structures)
      ? raw.structures
          .map((item) => pickEnum(item, STRUCTURE_TYPES, null))
          .filter(Boolean)
          .slice(0, 4)
      : fallback.structures,
    earthVisible: typeof raw.earthVisible === 'boolean' ? raw.earthVisible : fallback.earthVisible,
    animationSpeed:
      typeof raw.animationSpeed === 'number'
        ? Math.min(1, Math.max(0, raw.animationSpeed))
        : fallback.animationSpeed,
    effects: Array.isArray(raw.effects)
      ? raw.effects
          .map((item) => pickEnum(item, EFFECT_TYPES, null))
          .filter((item) => item && item !== 'none')
          .slice(0, 3)
      : fallback.effects,
  }
  return parseSceneConfiguration(candidate)
}

function sceneDirectorSystemPrompt() {
  return `You are a scene director for a procedural 360° world.
Convert room descriptions into structured scene parameters for a CSS + canvas + Three.js renderer.
Return ONLY a JSON object. No markdown. No code. No URLs. No JavaScript. No CSS.

Schema:
{
  "rooms": {
    "room1": {
      "environment": "forest|desert|ocean|space|mountain|city|cave|meadow|snow|swamp|egypt",
      "timeOfDay": "dawn|day|sunset|dusk|night",
      "sky": "clear|cloudy|overcast|stormy|stars|nebula|underwater",
      "ground": "grass|sand|rock|snow|water|dirt|metal|lunar|none",
      "terrain": "none|flat|hilly|lunar|desert|ocean_floor|rocky|metal",
      "fog": 0.0-1.0,
      "treeDensity": 0.0-1.0,
      "lighting": 0.0-1.0,
      "lightingStyle": "neutral|cool|warm|low|dramatic",
      "wind": 0.0-1.0,
      "particles": "none|fireflies|snow|dust|rain|sparks|bubbles|stars|sand|pollen",
      "colorMood": "warm|cool|neutral|eerie|vivid",
      "starDensity": 0.0-1.0,
      "planetCount": 0-6,
      "nebula": 0.0-1.0,
      "structures": ["space_station|spaceship|lander|pyramid|temple|obelisk|columns|coral|reef|habitat|ruins|rock_arch"],
      "earthVisible": true|false,
      "animationSpeed": 0.0-1.0,
      "effects": ["aurora|caustics|dust|heat_haze|godrays|embers"]
    }
  }
}

Rules:
- Include one entry per room id provided.
- Make the three rooms visually DISTINCT while sharing the theme.
- Space example: orbital station / moon surface / deep nebula.
- Underwater example: habitat / reef / underwater city.
- Egypt example: temple / pyramid interior / desert.
- Values must match the enums exactly. Numbers in range.
- Do not invent extra keys. structures and effects are arrays (max 4 / 3).
- Never output executable code, CSS, or URLs.`
}

async function completeChat({ apiKey, baseUrl, model, messages, timeoutMs }) {
  const response = await fetchWithRetry(
    chatCompletionsUrl(baseUrl),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages,
      }),
    },
    { timeoutMs: timeoutMs ?? 30_000, retries: 1 }
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error || `LLM request failed (${response.status})`
    throw new Error(typeof detail === 'string' ? detail : 'LLM request failed.')
  }

  const text = payload?.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('LLM returned an empty scene configuration.')
  }
  return text
}

export function heuristicScenesForSpecification(specification) {
  const rooms = {}
  for (const room of specification.rooms ?? []) {
    rooms[room.id] = sceneFromDescription(room.environment?.description, specification.theme, {
      id: room.id,
      name: room.name,
    })
  }
  return rooms
}

/**
 * LLM → validated scene map. Never executes model output.
 * On failure returns heuristic scenes derived from room descriptions.
 */
export async function directProceduralScenes({
  specification,
  prompt,
  apiKey,
  baseUrl,
  model,
  timeoutMs,
  log,
  requestId,
}) {
  const roomIds = (specification.rooms ?? []).map((room) => room.id)
  const fallback = heuristicScenesForSpecification(specification)

  if (!apiKey) {
    log?.('procedural_scene_fallback', { requestId, reason: 'no_llm_key' })
    return { scenes: fallback, source: 'heuristic' }
  }

  const roomBrief = (specification.rooms ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.environment?.description,
    tags: room.environment?.tags ?? [],
  }))

  try {
    log?.('procedural_scene_request', {
      requestId,
      path: 'LLM → JSON scene configuration → canvas/CSS/Three renderer',
      roomCount: roomIds.length,
    })
    const content = await completeChat({
      apiKey,
      baseUrl,
      model,
      timeoutMs,
      messages: [
        { role: 'system', content: sceneDirectorSystemPrompt() },
        {
          role: 'user',
          content: JSON.stringify({
            userPrompt: prompt,
            theme: specification.theme,
            rooms: roomBrief,
          }),
        },
      ],
    })

    const candidate = extractJsonObject(content)
    const roomsRaw = candidate.rooms ?? candidate
    const scenes = {}
    let usedLlm = false

    for (const id of roomIds) {
      const rawRoom = roomsRaw?.[id]
      try {
        const strict = RoomSceneMapSchema.safeParse({ [id]: rawRoom })
        if (strict.success && strict.data[id]) {
          scenes[id] = parseSceneConfiguration(strict.data[id])
          usedLlm = true
          continue
        }
        scenes[id] = sanitizeScene(rawRoom, fallback[id] ?? { ...DEFAULT_SCENE_CONFIGURATION })
        usedLlm = true
      } catch {
        scenes[id] = fallback[id] ?? { ...DEFAULT_SCENE_CONFIGURATION }
      }
    }

    if (!usedLlm) {
      throw new Error('No valid room scenes in LLM response.')
    }

    log?.('procedural_scene_ready', {
      requestId,
      source: 'llm',
      rooms: Object.keys(scenes),
    })
    return { scenes, source: 'llm' }
  } catch (error) {
    log?.('procedural_scene_fallback', {
      requestId,
      reason: error instanceof Error ? error.message : 'scene_director_failed',
    })
    return { scenes: fallback, source: 'heuristic' }
  }
}
