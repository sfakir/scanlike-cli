import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'

const require = createRequire(import.meta.url)
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs')
const pdfjsRoot = dirname(dirname(dirname(pdfjsPath)))

const CMAP_URL = join(pdfjsRoot, 'cmaps') + '/'
const STANDARD_FONT_DATA_URL = join(pdfjsRoot, 'standard_fonts') + '/'

interface CanvasAndContext {
  canvas: Canvas
  context: SKRSContext2D
}

class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    return { canvas, context }
  }

  reset(c: CanvasAndContext, width: number, height: number): void {
    c.canvas.width = width
    c.canvas.height = height
  }

  destroy(c: CanvasAndContext): void {
    c.canvas.width = 0
    c.canvas.height = 0
  }
}

export interface RenderedPage {
  canvas: Canvas
  width: number
  height: number
  ppi: number
  release(): void
}

export async function* renderPdfPages(
  pdfData: Uint8Array,
  scale: number,
  pageNumbers?: number[],
): AsyncGenerator<RenderedPage> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const loadingTask = getDocument({
    data: pdfData,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    CanvasFactory: NodeCanvasFactory,
  } as Parameters<typeof getDocument>[0] & { CanvasFactory: unknown })

  const pdf = await loadingTask.promise
  const factory = (pdf as unknown as { canvasFactory: NodeCanvasFactory })
    .canvasFactory
  const pages = pageNumbers ?? Array.from({ length: pdf.numPages }, (_, i) => i + 1)

  try {
    for (const pageNum of pages) {
      if (pageNum < 1 || pageNum > pdf.numPages) {
        throw new Error(`Page ${pageNum} out of range (1..${pdf.numPages})`)
      }

      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const c = factory.create(viewport.width, viewport.height)

      await page.render({
        canvasContext: c.context,
        viewport,
        background: 'rgb(255,255,255)',
      }).promise

      yield {
        canvas: c.canvas,
        width: viewport.width,
        height: viewport.height,
        ppi: scale * 72,
        release: () => {
          page.cleanup()
          factory.destroy(c)
        },
      }
    }
  } finally {
    await pdf.destroy()
  }
}

export async function getPdfPageCount(pdfData: Uint8Array): Promise<number> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({
    data: pdfData,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  }).promise
  const n = pdf.numPages
  await pdf.destroy()
  return n
}
