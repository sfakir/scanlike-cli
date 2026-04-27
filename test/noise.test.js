import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getNoiseCanvas } from '../dist/noise.js'

test('returns null for zero intensity', () => {
  assert.equal(getNoiseCanvas(0), null)
  assert.equal(getNoiseCanvas(-1), null)
})

test('returns a canvas with requested dimensions', () => {
  const c = getNoiseCanvas(0.1, 200, 100)
  assert.ok(c)
  assert.equal(c.width, 200)
  assert.equal(c.height, 100)
})

test('caches identical requests', () => {
  const a = getNoiseCanvas(0.5, 64, 64)
  const b = getNoiseCanvas(0.5, 64, 64)
  assert.strictEqual(a, b)
})

test('different intensities produce different canvases', () => {
  const a = getNoiseCanvas(0.1, 64, 64)
  const b = getNoiseCanvas(0.5, 64, 64)
  assert.notStrictEqual(a, b)
})

test('noise tile contains some opaque pixels', () => {
  const c = getNoiseCanvas(0.5, 32, 32)
  const ctx = c.getContext('2d')
  const { data } = ctx.getImageData(0, 0, 32, 32)
  let opaque = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) opaque += 1
  }
  // Density at intensity 0.5 should hit a noticeable fraction of pixels.
  assert.ok(opaque > 50, `expected >50 opaque pixels, got ${opaque}`)
})
