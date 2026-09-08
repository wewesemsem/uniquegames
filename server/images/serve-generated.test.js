import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generatedFileFromUrl } from './serve-generated.js'
import { join } from 'node:path'

describe('generated panorama static paths', () => {
  const root = join('/tmp', 'generated-root')

  it('resolves a safe panorama filename', () => {
    const path = generatedFileFromUrl('/generated/panoramas/9364d20d9a114af5107ee82b.png', root)
    assert.match(path, /9364d20d9a114af5107ee82b\.png$/)
  })

  it('rejects path traversal and unrelated URLs', () => {
    assert.equal(generatedFileFromUrl('/generated/panoramas/../secret.png', root), null)
    assert.equal(generatedFileFromUrl('/panoramas/room-1.jpg', root), null)
    assert.equal(generatedFileFromUrl('/generated/panoramas/foo.txt', root), null)
  })
})
