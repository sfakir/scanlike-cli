export const colorspaces = ['gray', 'sRGB'] as const
export type Colorspace = (typeof colorspaces)[number]

export const pageImageFormats = ['image/png', 'image/jpeg'] as const
export type PageImageFormat = (typeof pageImageFormats)[number]

export interface ScanConfig {
  rotate: number
  rotate_var: number
  colorspace: Colorspace
  blur: number
  noise: number
  border: boolean
  scale: number
  brightness: number
  yellowish: number
  contrast: number
  output_format: PageImageFormat
}

export const defaultConfig: ScanConfig = {
  rotate: 1,
  rotate_var: 0.5,
  colorspace: 'gray',
  blur: 0.3,
  noise: 0.1,
  border: false,
  scale: 2,
  brightness: 1,
  yellowish: 0,
  contrast: 1,
  output_format: 'image/jpeg',
}
