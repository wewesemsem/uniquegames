/**
 * Structured request logs. Never log API keys, secrets, or full prompts.
 */
export function createLogger(write = console.log) {
  return function log(event, fields = {}) {
    write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        ...fields,
      })
    )
  }
}
