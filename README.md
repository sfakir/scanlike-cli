# scanlike

[![npm](https://img.shields.io/npm/v/scanlike?color=cb3837&logo=npm)](https://www.npmjs.com/package/scanlike)
[![license](https://img.shields.io/npm/l/scanlike)](./LICENSE)
[![node](https://img.shields.io/node/v/scanlike)](https://nodejs.org)

📦 **npm:** https://www.npmjs.com/package/scanlike

Make PDFs look like they were printed and scanned. Inspired by [lookscanned.io](https://lookscanned.io), but rebuilt as a Node-native CLI **and** an MCP server you can hand to Claude or any other agent. No browser, no headless Chromium, no print dialog.

```sh
npx scanlike doc.pdf -o doc-scan.pdf
```

That's the whole experience. Original PDF in, scanned-looking PDF out.

## Why this exists

The original lookscanned.io is a brilliant browser app — but a browser app. You can't pipe it into a script, batch a folder, schedule it overnight, or let an LLM call it. `scanlike` is a from-scratch Node implementation of the same idea, packaged so that:

- **Humans** run it as a one-shot CLI: `npx scanlike doc.pdf -o doc-scan.pdf`
- **Scripts** import the library: `import { scanPdfToPdf } from 'scanlike'`
- **AI agents** call it through MCP: register `scanlike-mcp` once, and the agent gets a typed `scan_pdf` tool

Same scan effect (same defaults, same parameters) as the web app. No code shared with the upstream project — just the look.

## Use cases

- Print a signed, freshly-photocopied-looking version of a digital document
- Generate scan-style fixtures for a UX research session, a form-filling demo, or a PDF-OCR pipeline test
- Let an AI agent produce "human-looking" deliverables (e.g. mock invoices for testing, dirtied-up internal memos)
- Strip suspicious "born-digital" perfection from PDFs that need to look mailed-in

## Install

Two-and-a-half ways, pick one:

### A. Use it ad-hoc with npx (zero install)

```sh
npx scanlike doc.pdf -o doc-scan.pdf
```

First call downloads `scanlike` into the npx cache, every subsequent call is fast. Nothing in your global node_modules.

### B. Install globally

```sh
npm install -g scanlike
scanlike doc.pdf -o doc-scan.pdf
```

### C. As a library

```sh
npm install scanlike
```

```ts
import { scanPdfToPdf, scanPdfToImages, defaultConfig } from 'scanlike'
import { readFile, writeFile } from 'node:fs/promises'

const data = new Uint8Array(await readFile('doc.pdf'))

const pdf = await scanPdfToPdf(data, {
  config: { noise: 0.2, colorspace: 'sRGB' },
  onProgress: (done, total) => console.log(`${done}/${total}`),
})
await writeFile('out.pdf', pdf)

// Or stream per-page images:
for await (const page of scanPdfToImages(data, { config: { output_format: 'image/png' } })) {
  await writeFile(`page-${page.pageNumber}.png`, page.buffer)
}
```

Requires Node 18.17+.

## CLI

```
scanlike <input.pdf> -o <output> [options]
```

The output extension chooses the mode:

| `-o` ends in… | what scanlike writes |
|---|---|
| `.pdf` | a single scanned PDF |
| `.png` / `.jpg` | per-page images, named after the `-o` stem (or the input stem for multi-page) |
| anything else (or no extension) | a directory of per-page images, format from `--format` |

### Options

All defaults match lookscanned.io exactly.

| Flag | Default | Effect |
|---|---|---|
| `--rotate <deg>` | `1` | base rotation |
| `--rotate-var <deg>` | `0.5` | random per-page rotation variance |
| `--colorspace <gray\|sRGB>` | `gray` | gray = monochrome scanner; `sRGB` keeps color |
| `--blur <px>` | `0.3` | Gaussian blur radius |
| `--noise <0..1>` | `0.1` | paper-grain noise overlay |
| `--border` | off | thin black border |
| `--scale <n>` | `2` | render scale → output PPI = `scale × 72` |
| `--brightness <n>` | `1` | 1 = unchanged |
| `--yellowish <0..1>` | `0` | sepia tint, like an old copier |
| `--contrast <n>` | `1` | 1 = unchanged |
| `--format <png\|jpeg>` | `jpeg` | image encoding for pages (also used inside the PDF) |
| `--pages <range>` | all | subset, e.g. `1-3,5` |
| `-q`, `--quiet` | off | suppress progress on stderr |

### Recipes

```sh
# Default scanned look — what lookscanned.io produces in its default UI state
scanlike doc.pdf -o doc-scan.pdf

# Subtle, slightly aged copy
scanlike doc.pdf -o doc-scan.pdf --yellowish 0.15 --contrast 1.1

# "Freshly photocopied" — heavier grain, blur, with a border
scanlike doc.pdf -o doc-scan.pdf --noise 0.25 --blur 0.6 --border

# Color scan (e.g. brochure, marketing material)
scanlike doc.pdf -o doc-scan.pdf --colorspace sRGB --noise 0.05

# Just the first three pages, as PNGs in ./pages/
scanlike doc.pdf -o pages/ --format png --pages 1-3
```

## MCP server (for Claude Code, Claude Desktop, any MCP client)

`scanlike` ships with a second binary, `scanlike-mcp`, that speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio. Register it once and your agent gets a typed `scan_pdf` tool with full schema for every option.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "scanlike": {
      "command": "npx",
      "args": ["-y", "scanlike-mcp"]
    }
  }
}
```

Restart Claude Desktop. The `scan_pdf` tool appears in the tool palette.

### Claude Code

```sh
claude mcp add scanlike npx -- -y scanlike-mcp
```

Or hand-edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "scanlike": {
      "command": "npx",
      "args": ["-y", "scanlike-mcp"]
    }
  }
}
```

### The `scan_pdf` tool

```jsonc
{
  "name": "scan_pdf",
  "input": {
    "input_path":  "/abs/path/to/in.pdf",        // required, absolute
    "output_path": "/abs/path/to/out.pdf",       // required, absolute; extension picks the mode
    "pages":       [1, 2, 3],                    // optional subset
    "output_format": "jpeg",                     // optional: "png" | "jpeg"
    "options": {                                 // optional, all ScanConfig fields
      "noise": 0.2,
      "colorspace": "gray",
      "border": true
    }
  }
}
```

The agent gets a Zod-validated input schema, so it sees what each parameter does without you having to teach it.

## Architecture

Three replaceable stages:

```
PDF bytes ─► pdf-renderer ─► Canvas ─► scan-effect ─► JPEG/PNG ─► pdf-builder ─► PDF bytes
            (pdfjs-dist)              (@napi-rs/canvas)            (pdf-lib)
```

- **`pdf-renderer`** — `pdfjs-dist` rasterizes each page through a `@napi-rs/canvas`-backed `CanvasFactory`. Yields `Canvas` objects directly (no PNG buffer roundtrip — that path was unreliable in Node).
- **`scan-effect`** — applies `blur` / `grayscale` / `brightness` / `sepia` / `contrast` filters, rotates by `rotate ± rotate_var`, overlays noise.
- **`noise`** — generates the paper-grain overlay procedurally per pixel. (The original web app uses an SVG `<feSpecularLighting>` filter; resvg, used by `@napi-rs/canvas`, doesn't support specular lighting and renders that filter as opaque black.)
- **`pdf-builder`** — `pdf-lib` builds the output, sizing each page from PPI so physical dimensions are preserved.

## Tests

```sh
pnpm test
```

Uses `node:test` (built into Node ≥ 18) — no Jest, no Vitest, no extra deps. 37 tests covering config defaults, noise generation, scan effect output bytes, PDF builder round-trips, the library API on a real sample PDF, and the CLI invoked as a subprocess. Fixtures in `test/fixtures/`.

## Known limitations

- **JPEG round-trip into scanlike's own output PDFs** triggers a `DataCloneError` inside pdfjs-dist's loopback worker (canvas objects aren't `structuredClone`-able). Real user PDFs — including JPEG-embedded scanner output — work fine. If you really need to chain `scanlike → scanlike`, write the intermediate as `--format png`.
- **No page-level parallelism** yet. Sequential rendering is fast enough for typical documents (a 3-page report scans in <1 s on an M1). If you need parallelism, drive the library API from `worker_threads`.

## License

MIT. See `LICENSE`. Inspired by, but sharing no code with, [lookscanned.io](https://github.com/rwv/lookscanned.io) (also MIT).
