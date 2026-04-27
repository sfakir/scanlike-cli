import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createCanvas } from '@napi-rs/canvas'
import { buildPdf } from '../dist/pdf-builder.js'

function pageImage(format = 'image/jpeg') {
  const c = createCanvas(800, 1000)
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, 800, 1000)
  ctx.fillStyle = 'black'
  ctx.fillRect(50, 50, 700, 5)
  return {
    buffer: format === 'image/png' ? c.toBuffer('image/png') : c.toBuffer('image/jpeg', 90),
    format,
    width: 800,
    height: 1000,
    ppi: 144,
  }
}

test('produces a parseable PDF for a single JPEG page', async () => {
  const out = await buildPdf([pageImage('image/jpeg')])
  const doc = await PDFDocument.load(out)
  assert.equal(doc.getPageCount(), 1)
})

test('produces a parseable PDF for a single PNG page', async () => {
  const out = await buildPdf([pageImage('image/png')])
  const doc = await PDFDocument.load(out)
  assert.equal(doc.getPageCount(), 1)
})

test('multi-page PDF preserves page count', async () => {
  const out = await buildPdf([pageImage(), pageImage(), pageImage()])
  const doc = await PDFDocument.load(out)
  assert.equal(doc.getPageCount(), 3)
})

test('uses scanner-style Creator metadata to mimic a real scanner', async () => {
  // pdf-lib hard-codes Producer on save, but Creator is preserved.
  const out = await buildPdf([pageImage()])
  const doc = await PDFDocument.load(out)
  assert.match(doc.getCreator() ?? '', /TOSHIBA/)
})

test('PDF page dimensions match physical size from ppi', async () => {
  const out = await buildPdf([
    {
      ...pageImage(),
      width: 1224,
      height: 1584,
      ppi: 144,
    },
  ])
  const doc = await PDFDocument.load(out)
  const page = doc.getPage(0)
  // 1224/144*72 = 612 pt, 1584/144*72 = 792 pt → US Letter at 144 ppi.
  assert.equal(Math.round(page.getWidth()), 612)
  assert.equal(Math.round(page.getHeight()), 792)
})
