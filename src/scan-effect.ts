import { createCanvas, type Canvas } from '@napi-rs/canvas'
import type { ScanConfig } from './config.js'
import { getNoiseCanvas } from './noise.js'

export async function applyScanEffect(
  pageCanvas: Canvas,
  config: ScanConfig,
): Promise<Buffer> {
  const width = pageCanvas.width
  const height = pageCanvas.height

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, width, height)

  const filters: string[] = [`blur(${config.blur}px)`]
  if (config.colorspace === 'gray') filters.push('grayscale(1)')
  filters.push(`brightness(${config.brightness})`)
  filters.push(`sepia(${config.yellowish})`)
  filters.push(`contrast(${config.contrast})`)
  ctx.filter = filters.join(' ')

  const angleRad =
    ((config.rotate + config.rotate_var * Math.random()) * Math.PI) / 180
  ctx.translate(width / 2, height / 2)
  ctx.rotate(angleRad)
  ctx.translate(-width / 2, -height / 2)

  ctx.drawImage(pageCanvas as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0)

  ctx.resetTransform()
  ctx.filter = 'none'

  const noiseCanvas = getNoiseCanvas(config.noise)
  if (noiseCanvas) {
    ctx.drawImage(
      noiseCanvas as unknown as Parameters<typeof ctx.drawImage>[0],
      0,
      0,
      width,
      height,
    )
  }

  if (config.border) {
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, width, height)
  }

  if (config.output_format === 'image/jpeg') {
    return canvas.toBuffer('image/jpeg', 92)
  }
  return canvas.toBuffer('image/png')
}
