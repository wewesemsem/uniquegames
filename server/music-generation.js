import { extractJsonObject } from '../src/world/WorldSpecification.js'
import {
  heuristicMusicSpecification,
  safeParseMusicSpecification,
  sanitizeMusicSpecification,
} from '../src/audio/MusicSpecification.js'
import { fetchWithRetry } from './ai/http.js'
import { loadServerConfig, newRequestId } from './config.js'
import { PayloadTooLargeError, readJsonBody, sendJson } from './http.js'
import { createLogger } from './logging.js'

const MAX_MUSIC_PROMPT = 200
const MAX_BODY_BYTES = 2048

function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }
  return `${trimmed}/chat/completions`
}

function musicSystemPrompt() {
  return `You are a music director for a procedural Web Audio synthesizer.
The user message is ONLY a music prompt (mood / style / vibe). It is not a world or scene description — ignore any world meaning.
Return ONLY a JSON object. No markdown.

Schema:
{
  "label": "short_snake_name",
  "bpm": 48-180,
  "energy": 0.0-1.0,
  "tension": 0.0-1.0,
  "brightness": 0.0-1.0,
  "density": 0.0-1.0,
  "scale": "major|minor|dorian|phrygian|pentatonic|whole_tone|chromatic_sparse",
  "percussion": "none|sparse|steady|busy",
  "drone": true|false,
  "pad": "none|soft|thick",
  "rootMidi": 36-72
}

Be creative and specific so different prompts produce different scores.
Examples:
- "thriller" → tense mid-tempo minor/phrygian, steady pulse, drone on, moderate density
- "lo-fi rain" → slow, soft pad, sparse percussion, lower brightness
- nonsense words → invent a coherent musical vibe anyway`
}

async function completeChat({ apiKey, baseUrl, model, messages, timeoutMs, temperature }) {
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
        temperature: temperature ?? 0.9,
        messages,
      }),
    },
    { timeoutMs: timeoutMs ?? 20_000, retries: 1 }
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

async function composeWithLlm({ prompt, apiKey, baseUrl, model, timeoutMs, log, requestId }) {
  const messages = [
    { role: 'system', content: musicSystemPrompt() },
    { role: 'user', content: prompt },
  ]

  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    log?.('music_llm_request', { requestId, attempt })
    const content = await completeChat({
      apiKey,
      baseUrl,
      model,
      messages,
      timeoutMs,
      temperature: 0.95,
    })
    let candidate
    try {
      candidate = extractJsonObject(content)
    } catch (error) {
      lastError = error
      messages.push({ role: 'assistant', content })
      messages.push({
        role: 'user',
        content: `Invalid JSON (${error.message}). Return a single JSON object matching the schema. No markdown.`,
      })
      continue
    }

    const parsed = safeParseMusicSpecification(candidate)
    if (parsed.success) {
      return { specification: parsed.data, retries: attempt }
    }
    lastError = parsed.error
    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: `Validation failed. Return corrected JSON with bpm 48–180, floats 0–1, and allowed enums only.`,
    })
  }

  throw new Error(lastError?.message || 'Invalid music specification from the model.')
}

/**
 * Isolated music director — never reads the world prompt.
 */
export function createMusicComposeHandler(env = {}, deps = {}) {
  const config = deps.config ?? loadServerConfig(env)
  const log = deps.log ?? createLogger()
  const composeLlm = deps.composeLlm ?? composeWithLlm

  return async function handleMusicCompose(req, res) {
    const requestId = newRequestId()
    try {
      const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES })
      const allowed = new Set(['prompt'])
      if (body && typeof body === 'object') {
        for (const key of Object.keys(body)) {
          if (!allowed.has(key)) {
            sendJson(
              res,
              400,
              { error: 'invalid_request', message: 'Request may only include prompt.', requestId },
              { headers: { 'X-Request-ID': requestId } }
            )
            return
          }
        }
      }

      const prompt = String(body?.prompt ?? '').trim().slice(0, MAX_MUSIC_PROMPT)
      if (!prompt) {
        sendJson(
          res,
          200,
          {
            specification: heuristicMusicSpecification(''),
            director: 'heuristic',
            requestId,
          },
          { headers: { 'X-Request-ID': requestId } }
        )
        return
      }

      if (!config.llmApiKey) {
        sendJson(
          res,
          200,
          {
            specification: heuristicMusicSpecification(prompt),
            director: 'heuristic',
            notice: 'LLM_API_KEY is not set. Using the heuristic music director.',
            requestId,
          },
          { headers: { 'X-Request-ID': requestId } }
        )
        return
      }

      try {
        const result = await composeLlm({
          prompt,
          apiKey: config.llmApiKey,
          baseUrl: config.llmBaseUrl,
          model: config.llmModel,
          timeoutMs: Math.min(config.llmTimeoutMs, 25_000),
          log,
          requestId,
        })
        sendJson(
          res,
          200,
          {
            specification: sanitizeMusicSpecification(result.specification),
            director: 'llm',
            retries: result.retries ?? 0,
            requestId,
          },
          { headers: { 'X-Request-ID': requestId } }
        )
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown error'
        log('music_llm_failure', { requestId, detail: detail.slice(0, 240) })
        sendJson(
          res,
          200,
          {
            specification: heuristicMusicSpecification(prompt),
            director: 'heuristic',
            notice: `Music LLM failed (${detail.slice(0, 120)}). Used the heuristic music director.`,
            requestId,
          },
          { headers: { 'X-Request-ID': requestId } }
        )
      }
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        sendJson(res, 413, { error: 'payload_too_large', message: 'Music prompt too large.', requestId })
        return
      }
      if (error?.status === 400) {
        sendJson(res, 400, { error: 'invalid_json', message: error.message, requestId })
        return
      }
      sendJson(res, 500, {
        error: 'internal_error',
        message: error?.message || 'Internal server error.',
        requestId,
      })
    }
  }
}
