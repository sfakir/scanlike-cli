#!/usr/bin/env node
/**
 * For each demo input PDF and its corresponding output PDF, render page 1 of
 * each to PNG into ../demo/preview/ for easy side-by-side inspection.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderPdfPages } from '../dist/pdf-renderer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', 'demo')
const PREVIEW = join(ROOT, 'preview')
await mkdir(PREVIEW, { recursive: true })

async function renderFirstPage(pdfPath, outPng) {
  const buf = await readFile(pdfPath)
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  for await (const p of renderPdfPages(data, 1.5)) {
    await writeFile(outPng, p.canvas.toBuffer('image/png'))
    p.release()
    return
  }
}

const inputs = (await readdir(join(ROOT, 'input'))).filter((f) => f.endsWith('.pdf'))
for (const f of inputs) {
  const stem = f.replace(/\.pdf$/, '')
  const inPng = join(PREVIEW, `${stem}-input.png`)
  const outPng = join(PREVIEW, `${stem}-scan.png`)
  await renderFirstPage(join(ROOT, 'input', f), inPng)
  console.log('rendered', inPng)
  // Output PDFs use PNG-embedded pages so pdfjs can re-read them safely.
  // (We re-process the input via the library to a PNG-mode PDF to avoid the
  // known JPEG roundtrip pitfall.)
  await renderFirstPage(
    join(ROOT, 'output', `${stem}-scan.pdf`),
    outPng,
  ).catch(async (err) => {
    console.warn(`! ${stem}: ${err.message} — re-running with --format png`)
    const { spawn } = await import('node:child_process')
    await new Promise((res, rej) => {
      const cli = join(__dirname, '..', 'dist', 'cli.js')
      const p = spawn('node', [
        cli,
        join(ROOT, 'input', f),
        '-o', join(ROOT, 'output', `${stem}-scan-png.pdf`),
        '--format', 'png', '-q',
      ])
      p.on('close', (c) => (c === 0 ? res() : rej(new Error(`exit ${c}`))))
    })
    await renderFirstPage(
      join(ROOT, 'output', `${stem}-scan-png.pdf`),
      outPng,
    )
  })
  console.log('rendered', outPng)
}
