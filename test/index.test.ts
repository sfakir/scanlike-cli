import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  scanPdfToPdf,
  scanPdfToImages,
  defaultConfig,
  type ScannedImage,
} from '../dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures', 'sample.pdf')

async function loadFixture() {
  const buf = await readFile(FIXTURE)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

test('scanPdfToPdf returns a valid single-page PDF for sample.pdf', async () => {
  const data = await loadFixture()
  const out = await scanPdfToPdf(data)
  const doc = await PDFDocument.load(out)
  assert.equal(doc.getPageCount(), 1)
  assert.match(doc.getCreator() ?? '', /TOSHIBA/)
})

test('scanPdfToPdf reports progress for every rendered page', async () => {
  const data = await loadFixture()
  const seen: Array<[number, number]> = []
  await scanPdfToPdf(data, {
    onProgress: (done, total) => seen.push([done, total]),
  })
  assert.equal(seen.length, 1)
  assert.deepEqual(seen[0], [1, 1])
})

test('scanPdfToImages yields per-page JPEG buffers by default', async () => {
  const data = await loadFixture()
  const pages: ScannedImage[] = []
  for await (const p of scanPdfToImages(data)) {
    pages.push(p)
  }
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.pageNumber, 1)
  assert.equal(pages[0]!.format, 'image/jpeg')
  assert.equal(pages[0]!.buffer[0], 0xff)
  assert.equal(pages[0]!.buffer[1], 0xd8)
})

test('scanPdfToImages with --format png yields PNG buffers', async () => {
  const data = await loadFixture()
  const pages: ScannedImage[] = []
  for await (const p of scanPdfToImages(data, {
    config: { output_format: 'image/png' },
  })) {
    pages.push(p)
  }
  assert.equal(pages.length, 1)
  assert.equal(pages[0]!.format, 'image/png')
  assert.equal(pages[0]!.buffer[0], 0x89)
  assert.equal(pages[0]!.buffer[1], 0x50)
})

test('config overrides merge into defaults', async () => {
  const data = await loadFixture()
  const out = await scanPdfToPdf(data, {
    config: { noise: 0, blur: 0, rotate: 0, rotate_var: 0 },
  })
  const doc = await PDFDocument.load(out)
  assert.equal(doc.getPageCount(), 1)
})

test('throws on out-of-range page request', async () => {
  const data = await loadFixture()
  await assert.rejects(
    () => scanPdfToPdf(data, { pages: [99] }),
    /out of range/,
  )
})

test('respects --pages subset', async () => {
  const data = await loadFixture()
  const pages: number[] = []
  for await (const p of scanPdfToImages(data, { pages: [1] })) {
    pages.push(p.pageNumber)
  }
  assert.deepEqual(pages, [1])
})

test('default config is not mutated by overrides', async () => {
  const before = { ...defaultConfig }
  const data = await loadFixture()
  await scanPdfToPdf(data, { config: { noise: 0.5, rotate: 5 } })
  assert.deepEqual(defaultConfig, before)
})
