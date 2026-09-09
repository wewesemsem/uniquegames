/**
 * Frontend → API base URL.
 * Leave VITE_API_BASE_URL empty for local Vite (same-origin plugin).
 * Set to the Heroku origin for Netlify builds, e.g. https://uniquegames-api.herokuapp.com
 */

export function apiBaseUrl(env = import.meta.env) {
  return String(env?.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/$/, '')
}

export function apiUrl(path, env = import.meta.env) {
  const base = apiBaseUrl(env)
  const normalized = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalized}` : normalized
}

/** Point /generated/... assets at the API host when the UI is on another origin. */
export function resolveAssetUrl(url, env = import.meta.env) {
  if (url == null || url === '') {
    return url
  }
  const value = String(url)
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
    return value
  }
  if (value.includes('/generated/')) {
    const path = value.startsWith('/') ? value : `/${value}`
    return apiUrl(path, env)
  }
  return value
}
