#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, basename, join, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import {
  defaultConfig,
  scanPdfToPdf,
  scanPdfToImages,
  type ScanConfig,
} from './index.js'

const HELP = `scanlike — make PDFs look scanned

Usage:
  scanlike <input.pdf> -o <output> [options]

Output:
  -o, --output <path>      Output path. Extension decides the mode:
                             .pdf            → single scanned PDF
                             .png / .jpg     → directory of per-page images
                             (no extension)  → directory of per-page images (--format)

Scan options (defaults match lookscanned.io):
      --rotate <deg>       Base rotation in degrees (default ${defaultConfig.rotate})
      --rotate-var <deg>   Random rotation variance (default ${defaultConfig.rotate_var})
      --colorspace <s>     gray | sRGB (default ${defaultConfig.colorspace})
      --blur <px>          Gaussian blur radius (default ${defaultConfig.blur})
      --noise <n>          0..1 noise intensity (default ${defaultConfig.noise})
      --border             Draw a thin black border (default off)
      --scale <n>          Render scale, controls PPI = scale*72 (default ${defaultConfig.scale})
      --brightness <n>     1.0 = unchanged (default ${defaultConfig.brightness})
      --yellowish <n>      0..1 sepia (default ${defaultConfig.yellowish})
      --contrast <n>       1.0 = unchanged (default ${defaultConfig.contrast})
      --format <fmt>       png | jpeg — image encoding for pages
                             (default jpeg, also used inside the PDF)
      --pages <range>      Subset, e.g. "1-3,5" (default: all pages)
  -q, --quiet              Suppress progress output
  -h, --help               Show this help

Examples:
  scanlike doc.pdf -o doc-scan.pdf
  scanlike doc.pdf -o pages/ --format png
  scanlike doc.pdf -o doc.pdf --colorspace sRGB --noise 0.2 --border
`

interface ParsedFormatFlag {
  outputFormat: 'image/png' | 'image/jpeg'
}

function parseFormat(raw: string | undefined): ParsedFormatFlag['outputFormat'] | undefined {
  if (raw === undefined) return undefined
  const v = raw.toLowerCase()
  if (v === 'png' || v === 'image/png') return 'image/png'
  if (v === 'jpeg' || v === 'jpg' || v === 'image/jpeg') return 'image/jpeg'
  throw new Error(`--format must be png or jpeg, got "${raw}"`)
}

function parsePageRange(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined
  const out: number[] = []
  for (const part of raw.split(',')) {
    const seg = part.trim()
    if (!seg) continue
    const m = seg.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) throw new Error(`invalid --pages segment "${seg}"`)
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    for (let i = lo; i <= hi; i++) out.push(i)
  }
  return out.length ? out : undefined
}

function num(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${raw}"`)
  return n
}

function colorspace(raw: string | undefined): ScanConfig['colorspace'] | undefined {
  if (raw === undefined) return undefined
  if (raw === 'gray' || raw === 'sRGB') return raw
  throw new Error(`--colorspace must be gray or sRGB, got "${raw}"`)
}

interface OutputTarget {
  kind: 'pdf' | 'images'
  /** Directory to write images into (image mode) or full file path (pdf mode). */
  path: string
  /** Stem to use for per-page image filenames; null = derive from input. */
  stem: string | null
}

function resolveOutput(
  outFlag: string,
  formatFlag: 'image/png' | 'image/jpeg' | undefined,
): { target: OutputTarget; outputFormat: 'image/png' | 'image/jpeg' } {
  const ext = extname(outFlag).toLowerCase()

  if (ext === '.pdf') {
    return {
      target: { kind: 'pdf', path: outFlag, stem: null },
      outputFormat: formatFlag ?? 'image/jpeg',
    }
  }

  if (ext === '.png') {
    return {
      target: {
        kind: 'images',
        path: dirname(outFlag) || '.',
        stem: basename(outFlag, ext),
      },
      outputFormat: 'image/png',
    }
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    return {
      target: {
        kind: 'images',
        path: dirname(outFlag) || '.',
        stem: basename(outFlag, ext),
      },
      outputFormat: 'image/jpeg',
    }
  }

  // No recognizable extension → treat as directory, derive filenames from input
  return {
    target: { kind: 'images', path: outFlag, stem: null },
    outputFormat: formatFlag ?? 'image/jpeg',
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      rotate: { type: 'string' },
      'rotate-var': { type: 'string' },
      colorspace: { type: 'string' },
      blur: { type: 'string' },
      noise: { type: 'string' },
      border: { type: 'boolean' },
      scale: { type: 'string' },
      brightness: { type: 'string' },
      yellowish: { type: 'string' },
      contrast: { type: 'string' },
      format: { type: 'string' },
      pages: { type: 'string' },
      quiet: { type: 'boolean', short: 'q' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help || positionals.length === 0) {
    process.stdout.write(HELP)
    return
  }

  const inputPath = positionals[0]!
  if (!existsSync(inputPath)) {
    throw new Error(`input file not found: ${inputPath}`)
  }

  if (!values.output) {
    throw new Error('missing -o/--output')
  }

  const outputFormat = parseFormat(values.format as string | undefined)
  const { target, outputFormat: resolvedFormat } = resolveOutput(
    values.output,
    outputFormat,
  )

  const cfg: Partial<ScanConfig> = {
    output_format: resolvedFormat,
  }
  const r = num('--rotate', values.rotate as string | undefined)
  if (r !== undefined) cfg.rotate = r
  const rv = num('--rotate-var', values['rotate-var'] as string | undefined)
  if (rv !== undefined) cfg.rotate_var = rv
  const cs = colorspace(values.colorspace as string | undefined)
  if (cs !== undefined) cfg.colorspace = cs
  const b = num('--blur', values.blur as string | undefined)
  if (b !== undefined) cfg.blur = b
  const n = num('--noise', values.noise as string | undefined)
  if (n !== undefined) cfg.noise = n
  if (values.border) cfg.border = true
  const sc = num('--scale', values.scale as string | undefined)
  if (sc !== undefined) cfg.scale = sc
  const br = num('--brightness', values.brightness as string | undefined)
  if (br !== undefined) cfg.brightness = br
  const y = num('--yellowish', values.yellowish as string | undefined)
  if (y !== undefined) cfg.yellowish = y
  const co = num('--contrast', values.contrast as string | undefined)
  if (co !== undefined) cfg.contrast = co

  const pages = parsePageRange(values.pages as string | undefined)
  const quiet = Boolean(values.quiet)

  const buf = await readFile(inputPath)
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

  const log = (msg: string) => {
    if (!quiet) process.stderr.write(msg + '\n')
  }

  if (target.kind === 'pdf') {
    log(`scanning ${basename(inputPath)} → ${target.path}`)
    const out = await scanPdfToPdf(data, {
      config: cfg,
      pages,
      onProgress: (done, total) => log(`  page ${done}/${total}`),
    })
    await writeFile(target.path, out)
    log(`wrote ${target.path} (${out.byteLength} bytes)`)
    return
  }

  await mkdir(target.path, { recursive: true })
  const stem = target.stem ?? basename(inputPath, extname(inputPath))
  const ext = resolvedFormat === 'image/png' ? 'png' : 'jpg'

  log(`scanning ${basename(inputPath)} → ${target.path}/`)

  // Buffer one page so we can choose between "exact filename" (single-page) and
  // "indexed filenames" (multi-page) without re-parsing the PDF, which would
  // either be wasteful or — with pdfjs in Node — outright fail on the second
  // pass.
  const buffered = []
  for await (const img of scanPdfToImages(data, { config: cfg, pages })) {
    buffered.push(img)
  }

  const useExactName = target.stem !== null && buffered.length === 1

  for (const img of buffered) {
    const file = useExactName
      ? join(target.path, `${stem}.${ext}`)
      : join(
          target.path,
          `${stem}-${String(img.pageNumber).padStart(3, '0')}.${ext}`,
        )
    await writeFile(file, img.buffer)
    log(`  ${file}`)
  }
}

main().catch((err) => {
  process.stderr.write(`scanlike: ${(err as Error).message}\n`)
  process.exit(1)
})
