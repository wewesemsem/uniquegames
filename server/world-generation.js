import { join } from 'node:path'
import { createAssetResolver } from '../src/assets/AssetResolver.js'
import { createAssetCache } from '../src/assets/AssetCache.js'
import { assetCatalog } from '../src/assets/AssetCatalog.js'
import { createCatalogAssetProvider } from '../src/assets/CatalogAssetProvider.js'
import { createExternalAssetProvider } from '../src/assets/ExternalAssetProvider.js'
import { createGeneratedAssetProvider } from '../src/assets/GeneratedAssetProvider.js'
import { heuristicWorldFromPrompt } from '../src/world/heuristicDirector.js'
import { ensureThreeRooms } from '../src/world/WorldBuilder.js'
import {
  assertWorldSizeLimits,
  createWorldSpecificationSchema,
  extractJsonObject,
  formatWorldValidationError,
  parseWorldSpecification,
  safeParseWorldSpecification,
} from '../src/world/WorldSpecification.js'
import { createAbuseGuard } from './abuse.js'
import { fetchWithRetry } from './ai/http.js'
import {
  generationRatePolicies,
  hashPrompt,
  loadServerConfig,
  newRequestId,
  worldRatePolicies,
  ENVIRONMENT_MODES,
  parseEnvironmentMode,
} from './config.js'
import { createGenerationBudget } from './generation-budget.js'
import { PayloadTooLargeError, readJsonBody, sendJson, sendRateLimited, wantsNdjson, beginNdjson, writeNdjson } from './http.js'
import { createIdempotencyCache } from './idempotency.js'
import { getRequestSubject } from './identity.js'
import { createGeneratedDiskCacheProvider } from './images/DiskCacheProvider.js'
import { createOpenAIImageAssetProvider } from './images/OpenAIImageProvider.js'
import { createGeneratedImageStore } from './images/store.js'
import { createLogger } from './logging.js'
import { directProceduralScenes, heuristicScenesForSpecification } from './procedural/sceneDirector.js'
import { createRateLimiter } from './rate-limit/RateLimiter.js'
import { createRateLimitStore } from './rate-limit/store.js'
import { createAsset } from '../src/assets/AssetProvider.js'

function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }
  return `${trimmed}/chat/completions`
}

function directorSystemPrompt(limits) {
  return `You are a world director for a 360° WebXR exploration app.
You describe SCENE INTENT (composition) plus optional landmarks.
A Scene Composer expands composition into dense worlds.
Unknown concepts use GENERIC procedural descriptors (category/form/material) — never invent code, URLs, CSS, or JavaScript.
Return ONLY a JSON object. No markdown.

Schema:
{
  "theme": "short_snake_or_words",
  "description": "one sentence",
  "rooms": [
    {
      "id": "room1",
      "name": "Human name",
      "environment": {
        "type": "panorama",
        "description": "sky, lighting, terrain atmosphere for the 360 backdrop",
        "tags": ["tag1", "tag2"]
      },
      "composition": {
        "biome": "ocean_floor|coral_reef|open_ocean|desert_plateau|temple_court|tomb|meadow|forest|jungle|orbital|lunar|deep_space|urban|cave|alien|generic",
        "life": "none|sparse|moderate|abundant",
        "vegetation": "none|sparse|meadow|forest|jungle|coral_reef|desert_scrub|seaweed|fungal|alien",
        "large_features": "none|rocks|reef|ruins|pyramids|temples|station|buildings|ships|crystals|fungal_grove",
        "atmosphere": "clear|underwater_caustics|dusty|misty|starfield|nebula|godrays|pollen|bioluminescent",
        "density": 0.0-1.0,
        "motif": "optional short phrase for novel concepts, e.g. giant glowing mushrooms"
      },
      "animation": {
        "required": true,
        "static_scene": false,
        "behaviors": [
          {
            "target": "fish|seaweed|bubbles|particles|palm_tree|flower|bird|torch|atmosphere|…",
            "behavior": "swim|sway|fly|float|rise|orbit|pulse|wave|drift|rotate|flicker|school",
            "speed": "slow|medium|fast",
            "variation": "low|medium|high",
            "group_behavior": "none|schooling|flocking|clustered"
          }
        ]
      },
      "interactions": {
        "events": [
          {
            "id": "pyramid_entrance_mummy",
            "target": "pyramid|coral|flower|torch|spaceship|…",
            "trigger": "click|tap|vr_select|gaze|proximity|approach|enter_room|timed|after_event|multi_interact",
            "once": true,
            "proximity": 4,
            "gaze_duration": 1.2,
            "reaction": {
              "type": "creature_appearance|animal_appearance|spawn|reveal|open|glow|change_lighting|particles|swim|fly|emerge|…",
              "subject": "mummy|whale|butterfly|bird|…",
              "animation": "emerge_from_door|swim_into_scene|fly_in|open|glow_up|appear|…",
              "duration": 4,
              "once": true,
              "count": 1,
              "offset": [0, 0, 2]
            }
          }
        ]
      },
      "objects": [
        {
          "type": "pyramid|fish|flower|tree|spaceship|generic|mushroom|crystal_spire|…",
          "name": "optional label",
          "description": "what it is",
          "tags": ["landmark"],
          "category": "organic_plant|rock_formation|structure|vehicle|creature|artifact|floating_structure|crystalline|vegetation|prop",
          "form": "mushroom|crystalline|spire|dome|blob|cluster|arch|tower|platform|crystal|organic|block|sphere|ring|tree_like|rock",
          "appearance": {
            "scale_hint": "tiny|small|medium|large|giant",
            "color": "neutral|warm|cool|vivid|bioluminescent|metallic|earthy|dark|pastel",
            "surface": "matte|glossy|rough|glowing|translucent|crystalline",
            "emission": 0.0-1.0,
            "roughness": 0.0-1.0,
            "metalness": 0.0-1.0,
            "transparency": 0.0-1.0
          },
          "geometry": { "primary_form": "mushroom", "facets": 8, "height": 4, "width": 3 },
          "behavior": { "floating": false, "clustered": true, "count": 1 },
          "position": [x, y, z],
          "scale": [sx, sy, sz],
          "detail": "low|medium|high"
        }
      ],
      "hotspots": [
        { "id": "to_room2", "label": "Next place", "targetRoom": "room2", "description": "why go there" }
      ]
    }
  ]
}

Rules:
- Produce exactly ${Math.min(3, limits.maxRooms)} rooms with ids room1, room2, room3 when possible (at most ${limits.maxRooms}).
- ALWAYS include composition. Make rooms visually DISTINCT while sharing the theme.
- ALWAYS include animation unless the user explicitly asks for a static/frozen scene (then set static_scene true).
- Animation describes behaviors, not JavaScript. Architecture (pyramids, temples) may stay still while sand, birds, torches, particles, and atmosphere move.
- Underwater must animate fish (swim/schooling), seaweed (sway), bubbles (rise). Meadow: flowers sway, pollen drifts, birds fly. Egypt: sand/dust drifts, palms sway, torches flicker.
- Include interactions.events with a few meaningful scene reactions when appropriate (never executable code).
  Examples: Egypt pyramid click → mummy emerge_from_door; coral click → whale swim_into_scene; flower click → butterflies fly_in; torch proximity → change_lighting; spaceship approach → glow/activate.
- Interactions are structured data only: trigger + target + reaction. The app owns event handling and procedural spawning.
- Prefer specialized types when they exist (pyramid, fish, flower, tree, spaceship, …).
- For UNKNOWN concepts (mushroom, crystal city, alien flora, floating temples): use type "generic" OR a free-form type plus category/form/appearance/geometry/behavior. The engine builds primitives from those safe params.
- Example alien mushroom forest: biome alien, vegetation fungal, atmosphere bioluminescent, motif "giant glowing mushrooms", plus a few landmark generic mushrooms with emission.
- Example floating crystal city: biome alien, large_features crystals, motif "floating crystal city", objects with category floating_structure, form crystalline, behavior.floating true.
- objects[] is mainly 0–6 landmarks. Do NOT list every prop — composition + composer fill the world.
- Scale 0.2–16. No URLs, paths, code, or extra keys.
- At most ${limits.maxHotspotsPerRoom} hotspots per room; connect rooms with existing targetRoom ids.
- Keep strings short.`
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
        temperature: 0.4,
        messages,
      }),
    },
    { timeoutMs: timeoutMs ?? 45_000, retries: 1 }
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error || `LLM request failed (${response.status})`
    throw new Error(typeof detail === 'string' ? detail : 'LLM request failed.')
  }

  const text = payload?.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('LLM returned an empty response.')
  }
  return text
}

function normalizeSpecification(raw, schema, limits) {
  const parsed = parseWorldSpecification(raw, schema, limits)
  assertWorldSizeLimits(parsed, limits)
  const rooms = ensureThreeRooms(parsed).slice(0, limits.maxRooms)
  return parseWorldSpecification({ ...parsed, rooms }, schema, limits)
}

async function generateWithLlm({ prompt, apiKey, baseUrl, model, schema, limits, log, requestId, timeoutMs }) {
  const messages = [
    { role: 'system', content: directorSystemPrompt(limits) },
    { role: 'user', content: prompt },
  ]

  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    log?.('llm_request', { requestId, attempt })
    const content = await completeChat({ apiKey, baseUrl, model, messages, timeoutMs })
    let candidate
    try {
      candidate = extractJsonObject(content)
    } catch (error) {
      lastError = error
      messages.push({ role: 'assistant', content })
      messages.push({
        role: 'user',
        content: `Your previous output was not valid JSON (${error.message}). Return a single JSON object that matches the schema. No markdown.`,
      })
      continue
    }

    const parsed = safeParseWorldSpecification(candidate, schema, limits)
    if (parsed.success) {
      try {
        return { specification: normalizeSpecification(parsed.data, schema, limits), retries: attempt }
      } catch (error) {
        lastError = error
      }
    } else {
      lastError = parsed.error
    }

    const hint = formatWorldValidationError(lastError)
    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: `Validation failed: ${hint}. Return a corrected JSON object within room/object/hotspot limits. Scale values must be 0.2–16. No URLs, paths, or extra keys.`,
    })
  }

  throw new Error(`Invalid world specification from the model: ${formatWorldValidationError(lastError)}`)
}

export function createWorldGenerationHandler(env = {}, deps = {}) {
  const config = deps.config ?? loadServerConfig(env)
  const log = deps.log ?? createLogger()
  const now = deps.now ?? (() => Date.now())
  const store = deps.store ?? createRateLimitStore({ redisUrl: config.redisUrl, redisClient: deps.redisClient, now })
  const rateLimiter = deps.rateLimiter ?? createRateLimiter({ store, now })
  const abuse = deps.abuse ?? createAbuseGuard({ now })
  const idempotency = deps.idempotency ?? createIdempotencyCache({ now, ttlMs: 5 * 60_000 })
  const schema = createWorldSpecificationSchema(config.world)
  const getUserId = deps.getUserId
  const imageStore =
    deps.imageStore ??
    createGeneratedImageStore({
      rootDir: join(process.cwd(), config.generatedAssetDir),
    })

  function heuristicResult(prompt) {
    return {
      specification: normalizeSpecification(heuristicWorldFromPrompt(prompt), schema, config.world),
      director: 'heuristic',
      retries: 0,
      notice: 'LLM_API_KEY is not set. Using the heuristic world director.',
    }
  }

  async function defaultDirectWorld({ prompt, requestId }) {
    if (!config.llmApiKey) {
      return heuristicResult(prompt)
    }
    try {
      const result = await generateWithLlm({
        prompt,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        model: config.llmModel,
        schema,
        limits: config.world,
        log,
        requestId,
        timeoutMs: config.llmTimeoutMs,
      })
      return { ...result, director: 'llm' }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error'
      log('llm_failure', { requestId, reason: 'fallback_heuristic', detail: detail.slice(0, 240) })
      return {
        ...heuristicResult(prompt),
        notice: `LLM world director failed (${detail.slice(0, 120)}). Used the heuristic director.`,
      }
    }
  }

  const directWorld = deps.directWorld ?? defaultDirectWorld

  function defaultCreateResolver(resolverOptions = {}) {
    const environmentMode = resolverOptions.environmentMode ?? config.environmentMode
    const imageConfigured = Boolean(config.imageApiKey)
    const useImageGeneration = environmentMode === ENVIRONMENT_MODES.IMAGE_GENERATION
    const maxGeneratedImages =
      resolverOptions.maxGeneratedImages != null
        ? resolverOptions.maxGeneratedImages
        : useImageGeneration
          ? config.imageGenerationCount
          : 0

    // IMAGE_GENERATION path keeps the existing OpenAI image provider intact.
    // PROCEDURAL_360 skips expensive panorama providers entirely — image code stays imported.
    const panoramaProviders = useImageGeneration
      ? [
          createGeneratedDiskCacheProvider(imageStore),
          createCatalogAssetProvider(assetCatalog, {
            kinds: imageConfigured ? ['model'] : undefined,
          }),
          createExternalAssetProvider(),
          imageConfigured
            ? createOpenAIImageAssetProvider({
                apiKey: config.imageApiKey,
                baseUrl: config.imageBaseUrl,
                model: config.imageModel,
                size: config.imageSize || undefined,
                quality: config.imageQuality,
                timeoutMs: config.imageTimeoutMs,
                store: imageStore,
                fetchImpl: deps.imageFetch ?? fetchWithRetry,
              })
            : createGeneratedAssetProvider(),
        ]
      : [
          createCatalogAssetProvider(assetCatalog, { kinds: ['model'] }),
          createExternalAssetProvider(),
          createGeneratedAssetProvider(),
        ]

    const { environmentMode: _ignoredMode, maxGeneratedImages: _ignoredMax, ...rest } = resolverOptions
    return createAssetResolver({
      ...rest,
      providers: panoramaProviders,
      maxGeneratedImages: useImageGeneration ? maxGeneratedImages : 0,
    })
  }

  const createResolver = deps.createResolver ?? defaultCreateResolver
  const directScenes = deps.directScenes ?? directProceduralScenes

  function modelsFor(directed, environmentMode = config.environmentMode) {
    const procedural = environmentMode === ENVIRONMENT_MODES.PROCEDURAL_360
    return {
      director: directed.director === 'llm' ? config.llmModel : null,
      image: !procedural && config.imageApiKey ? config.imageModel : null,
      environmentMode,
      scene: procedural ? config.llmModel || 'heuristic' : null,
    }
  }

  function generationPayload(resolved, generation, duplicate, environmentMode = config.environmentMode) {
    const panoramaMisses = (resolved.generationRequests ?? []).filter(
      (item) => item.request?.kind === 'panorama' && !item.skipped
    )
    return {
      ...generation,
      missing: panoramaMisses.length,
      reasons: [...new Set(panoramaMisses.map((item) => item.reason).filter(Boolean))].slice(0, 3),
      duplicate: Boolean(duplicate),
      imageLimit: config.imageGenerationCount,
      environmentMode,
      sceneSource: resolved.sceneSource ?? null,
    }
  }

  function successPayload({ directed, resolved, generation, requestId, duplicate, environmentMode }) {
    const mode = environmentMode ?? config.environmentMode
    return {
      specification: directed.specification,
      resolved: {
        rooms: resolved.rooms,
      },
      director: directed.director,
      retries: directed.retries ?? 0,
      notice: directed.notice,
      models: modelsFor(directed, mode),
      generation: generationPayload(resolved, generation, duplicate, mode),
      environmentMode: mode,
      requestId,
    }
  }

  async function resolveProceduralWorld({ specification, prompt, requestId, onRoom, onStatus }) {
    await onStatus?.({ message: 'Designing procedural scenes...' })
    log('environment_pipeline', {
      requestId,
      mode: ENVIRONMENT_MODES.PROCEDURAL_360,
      path: 'LLM → JSON scene configuration → renderer',
    })

    const { scenes, source } = await Promise.resolve(
      directScenes({
        specification,
        prompt,
        apiKey: config.llmApiKey,
        baseUrl: config.llmBaseUrl,
        model: config.llmModel,
        timeoutMs: config.llmTimeoutMs,
        log,
        requestId,
      })
    ).catch((error) => {
      log('procedural_scene_fallback', {
        requestId,
        reason: error instanceof Error ? error.message : 'scene_director_threw',
      })
      return {
        scenes: heuristicScenesForSpecification(specification),
        source: 'heuristic',
      }
    })

    const generationRequests = []
    const rooms = []
    const total = specification.rooms.length

    for (const [index, room] of specification.rooms.entries()) {
      await onStatus?.({
        index,
        total,
        message: index === 0 ? 'Building the first procedural view...' : 'Almost done...',
      })

      // Resolve gameplay objects as cheap primitives only — never call image generation.
      const objects = []
      for (const object of room.objects) {
        objects.push({
          need: object,
          asset: createAsset({
            id: `procedural-${object.type}-${index}-${objects.length}`,
            kind: 'model',
            source: 'fallback',
            primitive: /sphere|planet|orb|moon|rock/i.test(`${object.type} ${object.description}`)
              ? 'sphere'
              : 'box',
            color: '#7a8499',
            description: object.description,
          }),
        })
      }

      const entry = {
        spec: room,
        panorama: null,
        procedural: scenes[room.id] ?? scenes[Object.keys(scenes)[0]] ?? null,
        objects,
      }
      rooms.push(entry)
      await onRoom?.({ room: entry, index, total })
      // Yield so the client can reveal room1 and paint before room2/3 arrive.
      if (index < total - 1) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }

    return {
      rooms,
      generationRequests,
      generation: { generatedAssets: 0, remaining: 0, maxGeneratedAssets: 0 },
      sceneSource: source,
    }
  }

  async function produceWorld({ prompt, requestId, subject, rates, environmentMode, onWorld, onRoom, onStatus }) {
    const mode = parseEnvironmentMode(environmentMode, config.environmentMode)
    await onStatus?.({ message: 'Building your world...' })
    const directed = await directWorld({ prompt, requestId, subject })
    assertWorldSizeLimits(directed.specification, config.world)
    directed.environmentMode = mode
    await onWorld?.(directed)

    if (mode === ENVIRONMENT_MODES.PROCEDURAL_360) {
      const resolved = await resolveProceduralWorld({
        specification: directed.specification,
        prompt,
        requestId,
        onRoom,
        onStatus,
      })
      return { directed, resolved, generation: resolved.generation, environmentMode: mode }
    }

    log('environment_pipeline', {
      requestId,
      mode: ENVIRONMENT_MODES.IMAGE_GENERATION,
      path: 'LLM → image model → 360 image',
      imageModel: config.imageModel,
      imageQuality: config.imageQuality,
    })
    await onStatus?.({ message: 'Painting high-quality 360° skies (this can take 1–2 minutes)...' })

    const roomCount = directed.specification.rooms?.length ?? config.world.maxRooms
    // Generate a panorama for every room so rooms 2–3 can stream in behind room 1.
    const maxGeneratedImages = Math.min(
      roomCount,
      Math.max(config.imageGenerationCount, roomCount),
      config.world.maxGeneratedAssetsPerWorld
    )

    const generationBudget = createGenerationBudget({
      requestId,
      userKey: subject.key,
      maxGeneratedAssets: Math.max(config.world.maxGeneratedAssetsPerWorld, maxGeneratedImages),
    })

    const resolver = createResolver({
      cache: createAssetCache(),
      generationBudget,
      generationLimiter: rateLimiter,
      generationPolicies: generationRatePolicies(rates),
      subjectKey: subject.key,
      log,
      requestId,
      environmentMode: mode,
      maxGeneratedImages,
    })

    const resolved = await resolver.resolveWorld(directed.specification, { onRoom, onStatus })
    return { directed, resolved, generation: generationBudget.snapshot(), environmentMode: mode }
  }

  return async function handleWorldGenerate(req, res) {
    const started = now()
    const requestId = newRequestId(req.headers?.['x-request-id'])
    res.setHeader('X-Request-ID', requestId)
    const subject = getRequestSubject(req, { getUserId })
    const rates = subject.authenticated ? config.rates.authenticated : config.rates.anonymous

    log('request_received', {
      requestId,
      route: '/api/world/generate',
      subject: subject.key,
    })

    let body
    try {
      body = await readJsonBody(req, { maxBytes: config.world.maxRequestBodyBytes })
    } catch (error) {
      if (error instanceof PayloadTooLargeError || error.status === 413) {
        log('validation_failure', { requestId, reason: 'payload_too_large' })
        sendJson(res, 413, { error: 'payload_too_large', message: 'Payload Too Large' }, { headers: { 'X-Request-ID': requestId } })
        return
      }
      abuse.recordValidationFailure(subject.key)
      log('validation_failure', { requestId, reason: 'malformed_json' })
      sendJson(res, 400, { error: 'invalid_request', message: 'Request body must be JSON.' }, { headers: { 'X-Request-ID': requestId } })
      return
    }

    const rate = await rateLimiter.consume(subject.key, worldRatePolicies(rates))
    if (!rate.allowed) {
      log('rate_limited', { requestId, subject: subject.key, retryAfter: rate.retryAfter })
      sendRateLimited(res, { retryAfter: rate.retryAfter, requestId })
      return
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) {
      abuse.recordValidationFailure(subject.key)
      log('validation_failure', { requestId, reason: 'empty_prompt' })
      sendJson(res, 400, { error: 'invalid_request', message: 'Describe a world to explore.' }, { headers: { 'X-Request-ID': requestId } })
      return
    }
    if (prompt.length > config.world.maxPromptLength) {
      abuse.recordValidationFailure(subject.key)
      log('validation_failure', { requestId, reason: 'prompt_too_long', promptLength: prompt.length })
      sendJson(
        res,
        400,
        { error: 'invalid_request', message: 'Prompt is too long.' },
        { headers: { 'X-Request-ID': requestId } }
      )
      return
    }

    const allowedKeys = new Set(['prompt', 'environmentMode'])
    const extraKeys = Object.keys(body).filter((key) => !allowedKeys.has(key))
    if (extraKeys.length > 0) {
      abuse.recordValidationFailure(subject.key)
      log('validation_failure', { requestId, reason: 'unexpected_fields' })
      sendJson(res, 400, { error: 'invalid_request', message: 'Request may only include prompt and environmentMode.' }, { headers: { 'X-Request-ID': requestId } })
      return
    }

    const environmentMode = parseEnvironmentMode(body.environmentMode, config.environmentMode)

    const promptHash = hashPrompt(`${environmentMode}:${prompt}`)
    abuse.recordIdentical(subject.key, promptHash)
    const restriction = abuse.restriction(subject.key, promptHash)
    if (restriction.restricted) {
      log('rate_limited', { requestId, subject: subject.key, retryAfter: restriction.retryAfter, reason: restriction.reason })
      sendRateLimited(res, {
        retryAfter: restriction.retryAfter,
        requestId,
        message: 'Too many requests. Please try again later.',
      })
      return
    }

    try {
      const stream = wantsNdjson(req)

      if (stream) {
        beginNdjson(res, { requestId })
        writeNdjson(res, {
          type: 'status',
          message:
            environmentMode === ENVIRONMENT_MODES.IMAGE_GENERATION
              ? 'Painting high-quality 360° skies (this can take 1–2 minutes)...'
              : 'Building your world...',
        })

        const produced = await produceWorld({
          prompt,
          requestId,
          subject,
          rates,
          environmentMode,
          onStatus: ({ message, index, total }) => {
            writeNdjson(res, { type: 'status', message, index, total })
          },
          onWorld: (directed) => {
            writeNdjson(res, {
              type: 'world',
              specification: directed.specification,
              director: directed.director,
              retries: directed.retries ?? 0,
              notice: directed.notice,
              models: modelsFor(directed, environmentMode),
              environmentMode,
              requestId,
            })
          },
          onRoom: ({ room, index, total }) => {
            writeNdjson(res, { type: 'room', room, index, total })
          },
        })

        const payload = successPayload({ ...produced, requestId, duplicate: false })
        const panoramaMisses = produced.resolved.generationRequests.filter(
          (item) => item.request?.kind === 'panorama' && !item.skipped
        )
        log('request_completed', {
          requestId,
          route: '/api/world/generate',
          status: 200,
          duration: now() - started,
          director: produced.directed.director,
          duplicate: false,
          environmentMode,
          generationCount: produced.generation?.generatedAssets ?? 0,
          panoramaFailures: panoramaMisses.length,
          stream: true,
        })
        writeNdjson(res, { type: 'done', generation: payload.generation, resolved: payload.resolved })
        res.end()
        return
      }

      const job = await idempotency.run(`${subject.key}:${promptHash}`, async () =>
        produceWorld({ prompt, requestId, subject, rates, environmentMode })
      )

      const { directed, resolved, generation } = job.value
      const payload = successPayload({
        directed,
        resolved,
        generation,
        requestId,
        duplicate: job.duplicate,
        environmentMode: job.value.environmentMode ?? environmentMode,
      })
      log('request_completed', {
        requestId,
        route: '/api/world/generate',
        status: 200,
        duration: now() - started,
        director: directed.director,
        duplicate: job.duplicate,
        environmentMode: payload.environmentMode,
        generationCount: generation?.generatedAssets ?? 0,
        panoramaFailures: payload.generation.missing,
      })

      sendJson(res, 200, payload, { headers: { 'X-Request-ID': requestId } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'World generation failed.'
      const overLimit = /exceeds max/i.test(message)
      if (res.headersSent) {
        writeNdjson(res, {
          type: 'error',
          error: overLimit ? 'invalid_world' : 'director_failed',
          message: overLimit ? 'The generated world exceeded size limits.' : 'Could not build that world. Please try again.',
        })
        res.end()
        return
      }
      if (overLimit) {
        abuse.recordValidationFailure(subject.key)
        log('world_specification_rejected', { requestId, reason: message })
        sendJson(
          res,
          422,
          { error: 'invalid_world', message: 'The generated world exceeded size limits.' },
          { headers: { 'X-Request-ID': requestId } }
        )
        return
      }

      log('llm_failure', { requestId, reason: 'director_error' })
      sendJson(
        res,
        502,
        { error: 'director_failed', message: 'Could not build that world. Please try again.' },
        { headers: { 'X-Request-ID': requestId } }
      )
    }
  }
}