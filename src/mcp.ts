#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve, basename, extname, join } from 'node:path'
import { z } from 'zod'
import {
  defaultConfig,
  scanPdfToPdf,
  scanPdfToImages,
  type ScanConfig,
} from './index.js'

const server = new McpServer({
  name: 'scanlike',
  version: '0.1.0',
})

const ScanOptions = z.object({
  rotate: z
    .number()
    .describe(`Base rotation in degrees (default ${defaultConfig.rotate}).`)
    .optional(),
  rotate_var: z
    .number()
    .describe(`Random rotation variance per page (default ${defaultConfig.rotate_var}).`)
    .optional(),
  colorspace: z
    .enum(['gray', 'sRGB'])
    .describe(`'gray' (default) for monochrome scanner look, 'sRGB' to keep color.`)
    .optional(),
  blur: z
    .number()
    .describe(`Gaussian blur radius in px (default ${defaultConfig.blur}).`)
    .optional(),
  noise: z
    .number()
    .describe(`Paper-grain noise 0..1 (default ${defaultConfig.noise}).`)
    .optional(),
  border: z
    .boolean()
    .describe('Draw a thin black border (default false).')
    .optional(),
  scale: z
    .number()
    .describe(`Render scale → PPI = scale * 72 (default ${defaultConfig.scale}).`)
    .optional(),
  brightness: z
    .number()
    .describe(`1.0 = unchanged (default ${defaultConfig.brightness}).`)
    .optional(),
  yellowish: z
    .number()
    .describe(`Sepia 0..1 (default ${defaultConfig.yellowish}).`)
    .optional(),
  contrast: z
    .number()
    .describe(`1.0 = unchanged (default ${defaultConfig.contrast}).`)
    .optional(),
})

const ScanPdfInput = {
  input_path: z
    .string()
    .describe('Absolute path to the source PDF file.'),
  output_path: z
    .string()
    .describe(
      'Absolute path to write to. Extension decides the mode: ' +
        '.pdf → single scanned PDF; .png/.jpg → per-page images in the same directory; ' +
        'no extension → per-page images in this directory (format from output_format).',
    ),
  pages: z
    .array(z.number().int().positive())
    .describe('Optional 1-based page subset, e.g. [1,2,3]. Default: all pages.')
    .optional(),
  output_format: z
    .enum(['png', 'jpeg'])
    .describe('Image encoding for pages (default jpeg). Used inside the PDF and as image extension.')
    .optional(),
  options: ScanOptions.describe('Scan-effect parameters. Defaults match lookscanned.io.').optional(),
}

function requireAbsolute(p: string, label: string): string {
  if (!isAbsolute(p)) {
    throw new Error(`${label} must be an absolute path; got "${p}"`)
  }
  return resolve(p)
}

function buildConfig(opts: z.infer<typeof ScanOptions> | undefined, format: 'png' | 'jpeg'): Partial<ScanConfig> {
  const cfg: Partial<ScanConfig> = {
    output_format: format === 'png' ? 'image/png' : 'image/jpeg',
  }
  if (!opts) return cfg
  if (opts.rotate !== undefined) cfg.rotate = opts.rotate
  if (opts.rotate_var !== undefined) cfg.rotate_var = opts.rotate_var
  if (opts.colorspace !== undefined) cfg.colorspace = opts.colorspace
  if (opts.blur !== undefined) cfg.blur = opts.blur
  if (opts.noise !== undefined) cfg.noise = opts.noise
  if (opts.border !== undefined) cfg.border = opts.border
  if (opts.scale !== undefined) cfg.scale = opts.scale
  if (opts.brightness !== undefined) cfg.brightness = opts.brightness
  if (opts.yellowish !== undefined) cfg.yellowish = opts.yellowish
  if (opts.contrast !== undefined) cfg.contrast = opts.contrast
  return cfg
}

server.registerTool(
  'scan_pdf',
  {
    description:
      'Make a PDF look like it was printed and scanned. Reads input_path, ' +
      'writes a scanned PDF or per-page images to output_path. ' +
      'Defaults reproduce the lookscanned.io look.',
    inputSchema: ScanPdfInput,
  },
  async ({ input_path, output_path, pages, output_format, options }) => {
    const inPath = requireAbsolute(input_path, 'input_path')
    const outPath = requireAbsolute(output_path, 'output_path')

    if (!existsSync(inPath)) {
      throw new Error(`input_path does not exist: ${inPath}`)
    }

    const ext = extname(outPath).toLowerCase()
    const requestedFormat: 'png' | 'jpeg' =
      ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : output_format ?? 'jpeg'

    const cfg = buildConfig(options, requestedFormat)
    const buf = await readFile(inPath)
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)

    if (ext === '.pdf') {
      const out = await scanPdfToPdf(data, { config: cfg, pages })
      await mkdir(dirname(outPath), { recursive: true })
      await writeFile(outPath, out)
      return {
        content: [
          {
            type: 'text',
            text: `Wrote ${outPath} (${out.byteLength} bytes).`,
          },
        ],
      }
    }

    // Image mode
    const dir = ext ? dirname(outPath) : outPath
    const stem = ext ? basename(outPath, ext) : null
    await mkdir(dir, { recursive: true })

    const inputStem = basename(inPath, extname(inPath))
    const imgExt = requestedFormat === 'png' ? 'png' : 'jpg'

    const written: string[] = []
    const buffered = []
    for await (const img of scanPdfToImages(data, { config: cfg, pages })) {
      buffered.push(img)
    }
    const useExactName = stem !== null && buffered.length === 1
    for (const img of buffered) {
      const file = useExactName
        ? join(dir, `${stem}.${imgExt}`)
        : join(
            dir,
            `${stem ?? inputStem}-${String(img.pageNumber).padStart(3, '0')}.${imgExt}`,
          )
      await writeFile(file, img.buffer)
      written.push(file)
    }

    return {
      content: [
        {
          type: 'text',
          text: `Wrote ${written.length} file(s):\n${written.join('\n')}`,
        },
      ],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stdout is reserved for JSON-RPC; log to stderr only.
  console.error('scanlike MCP server ready (stdio)')
}

main().catch((err) => {
  console.error('scanlike-mcp fatal:', err)
  process.exit(1)
})
