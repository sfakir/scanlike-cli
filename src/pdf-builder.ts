import { PDFDocument } from 'pdf-lib'

export interface PageImage {
  buffer: Buffer
  format: 'image/png' | 'image/jpeg'
  width: number
  height: number
  ppi: number
}

export async function buildPdf(pages: PageImage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  for (const page of pages) {
    const widthPt = (page.width / page.ppi) * 72
    const heightPt = (page.height / page.ppi) * 72

    const embedded =
      page.format === 'image/png'
        ? await doc.embedPng(page.buffer)
        : await doc.embedJpg(page.buffer)

    const pdfPage = doc.addPage([widthPt, heightPt])
    pdfPage.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt })
  }

  // Creator survives pdf-lib's save(), Producer does not — pdf-lib hard-codes
  // its own Producer string. Setting Creator alone is enough scanner-style
  // metadata for casual inspection; pixel-level forensics defeat any header
  // anyway.
  doc.setCreator('TOSHIBA e-STUDIO2010AC')

  return doc.save()
}
