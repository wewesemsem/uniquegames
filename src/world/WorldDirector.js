import { generateWorldSpecification } from '../api/worldApi.js'

/**
 * Client World Director.
 *
 * The browser never talks to an LLM vendor. It sends text to our API,
 * which returns a validated World Specification.
 */
export async function directWorld(prompt, options) {
  const text = String(prompt ?? '').trim()
  if (!text) {
    throw new Error('Describe a world to explore.')
  }
  return generateWorldSpecification(text, options)
}
