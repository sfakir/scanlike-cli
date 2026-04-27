import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCanvas } from '@napi-rs/canvas'
import { applyScanEffect } from '../dist/scan-effect.js'
import { defaultConfig } from '../dist/index.js'

function makePageCanvas(width = 400, height = 600) {
  const c = createCanvas(width, height)
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = 'black'
  ctx.font = '40px sans-serif'
  ctx.fillText('SAMPLE', 80, 200)
  return c
}

test('produces a JPEG buffer with JPEG magic bytes', async () => {
  const buf = await applyScanEffect(makePageCanvas(), {
    ...defaultConfig,
    output_format: 'image/jpeg',
  })
  assert.ok(Buffer.isBuffer(buf))
  assert.equal(buf[0], 0xff)
  assert.equal(buf[1], 0xd8) // JPEG SOI
  assert.ok(buf.length > 1000)
})

test('produces a PNG buffer with PNG magic bytes', async () => {
  const buf = await applyScanEffect(makePageCanvas(), {
    ...defaultConfig,
    output_format: 'image/png',
  })
  assert.ok(Buffer.isBuffer(buf))
  assert.equal(buf[0], 0x89)
  assert.equal(buf[1], 0x50)
  assert.equal(buf[2], 0x4e)
  assert.equal(buf[3], 0x47) // PNG signature
})

test('respects noise=0 (no overlay)', async () => {
  const buf = await applyScanEffect(makePageCanvas(), {
    ...defaultConfig,
    noise: 0,
    output_format: 'image/png',
  })
  assert.ok(buf.length > 0)
})

test('color and gray modes both succeed', async () => {
  const gray = await applyScanEffect(makePageCanvas(), {
    ...defaultConfig,
    colorspace: 'gray',
    output_format: 'image/png',
  })
  const color = await applyScanEffect(makePageCanvas(), {
    ...defaultConfig,
    colorspace: 'sRGB',
    output_format: 'image/png',
  })
  assert.ok(gray.length > 0 && color.length > 0)
  assert.notDeepEqual(gray, color, 'gray and color should differ')
})

test('does not crash with extreme settings', async () => {
  const buf = await applyScanEffect(makePageCanvas(100, 100), {
    rotate: 5,
    rotate_var: 2,
    colorspace: 'sRGB',
    blur: 2,
    noise: 0.9,
    border: true,
    scale: 1,
    brightness: 1.4,
    yellowish: 0.3,
    contrast: 1.5,
    output_format: 'image/png',
  })
  assert.ok(buf.length > 0)
})
