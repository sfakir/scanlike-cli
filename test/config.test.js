import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultConfig, colorspaces } from '../dist/index.js'

test('defaultConfig matches lookscanned.io reference', () => {
  assert.deepEqual(defaultConfig, {
    rotate: 1,
    rotate_var: 0.5,
    colorspace: 'gray',
    blur: 0.3,
    noise: 0.1,
    border: false,
    scale: 2,
    brightness: 1,
    yellowish: 0,
    contrast: 1,
    output_format: 'image/jpeg',
  })
})

test('colorspaces exports the canonical list', () => {
  assert.deepEqual([...colorspaces], ['gray', 'sRGB'])
})
