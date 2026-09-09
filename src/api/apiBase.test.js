import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { apiBaseUrl, apiUrl, resolveAssetUrl } from './apiBase.js'

describe('apiBase', () => {
  it('uses relative paths when VITE_API_BASE_URL is empty', () => {
    const env = { VITE_API_BASE_URL: '' }
    assert.equal(apiBaseUrl(env), '')
    assert.equal(apiUrl('/api/world/generate', env), '/api/world/generate')
    assert.equal(resolveAssetUrl('/generated/panoramas/a.png', env), '/generated/panoramas/a.png')
  })

  it('prefixes the Heroku origin when configured', () => {
    const env = { VITE_API_BASE_URL: 'https://api.example.com/' }
    assert.equal(apiBaseUrl(env), 'https://api.example.com')
    assert.equal(apiUrl('/api/world/generate', env), 'https://api.example.com/api/world/generate')
    assert.equal(
      resolveAssetUrl('/generated/panoramas/a.png', env),
      'https://api.example.com/generated/panoramas/a.png'
    )
  })

  it('leaves absolute and static asset URLs alone', () => {
    const env = { VITE_API_BASE_URL: 'https://api.example.com' }
    assert.equal(resolveAssetUrl('https://cdn.example/x.png', env), 'https://cdn.example/x.png')
    assert.equal(resolveAssetUrl('/panoramas/room-1.jpg', env), '/panoramas/room-1.jpg')
  })
})
