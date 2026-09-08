export function hash01(seed, salt = 0) {
  const x = Math.sin(Number(seed) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export function hashInt(text) {
  let hash = 0
  for (const char of String(text)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash || 1
}
