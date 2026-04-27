import { defaultConfig, type ScanConfig } from './config.js'
import { renderPdfPages } from './pdf-renderer.js'
import { applyScanEffect } from './scan-effect.js'
import { buildPdf, type PageImage } from './pdf-builder.js'

export { defaultConfig, colorspaces } from './config.js'
export type { ScanConfig, Colorspace, PageImageFormat } from './config.js'

export interface ScanOptions {
  config?: Partial<ScanConfig>
  pages?: number[]
  onProgress?: (done: number, total: number) => void
}

export async function scanPdfToPdf(
  pdfData: Uint8Array,
  options: ScanOptions = {},
): Promise<Uint8Array> {
  const config = { ...defaultConfig, ...options.config }
  const pages: PageImage[] = []

  let done = 0
  const total = options.pages?.length

  for await (const page of renderPdfPages(pdfData, config.scale, options.pages)) {
    const buffer = await applyScanEffect(page.canvas, config)
    pages.push({
      buffer,
      format: config.output_format,
      width: page.width,
      height: page.height,
      ppi: page.ppi,
    })
    page.release()
    done += 1
    options.onProgress?.(done, total ?? done)
  }

  return buildPdf(pages)
}

export interface ScannedImage {
  pageNumber: number
  buffer: Buffer
  format: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

export async function* scanPdfToImages(
  pdfData: Uint8Array,
  options: ScanOptions = {},
): AsyncGenerator<ScannedImage> {
  const config = { ...defaultConfig, ...options.config }
  const pages = options.pages
  let i = 0

  for await (const page of renderPdfPages(pdfData, config.scale, pages)) {
    const buffer = await applyScanEffect(page.canvas, config)
    page.release()
    const pageNumber = pages?.[i] ?? i + 1
    i += 1
    yield {
      pageNumber,
      buffer,
      format: config.output_format,
      width: page.width,
      height: page.height,
    }
  }
}
