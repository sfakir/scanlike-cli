import { createCanvas, type Canvas } from '@napi-rs/canvas'

const noiseCache = new Map<string, Canvas>()

/**
 * Build a procedural noise tile. Returns a canvas with monochrome speckle
 * over a transparent background. `intensity` 0..1 controls visibility:
 *   - sparser dark specks at low intensity (subtle paper grain)
 *   - denser, slightly stronger at higher intensity
 *
 * The original lookscanned.io uses an SVG <feSpecularLighting> over fractal
 * turbulence. resvg (used by @napi-rs/canvas) does not support specular
 * lighting, so we generate equivalent perceptual noise procedurally.
 */
export function getNoiseCanvas(
  intensity: number,
  width = 1024,
  height = 1024,
): Canvas | null {
  if (intensity <= 0) return null

  const key = `${intensity.toFixed(3)}-${width}x${height}`
  const cached = noiseCache.get(key)
  if (cached) return cached

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(width, height)
  const data = img.data

  // Density and per-speckle alpha both scale with intensity.
  const density = Math.min(0.45, 0.08 + intensity * 0.6)
  const maxAlpha = Math.min(220, Math.round(60 + intensity * 200))

  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() > density) {
      data[i + 3] = 0
      continue
    }
    // Bias toward darker shades — looks like ink/paper grain rather than
    // a uniform haze. Pure black would be too harsh.
    const v = Math.floor(Math.random() * 80)
    const a = Math.floor(Math.random() * maxAlpha)
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = a
  }

  ctx.putImageData(img, 0, 0)
  noiseCache.set(key, canvas)
  return canvas
}
