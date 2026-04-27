import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type SpawnOptions } from 'node:child_process'
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PDFDocument } from 'pdf-lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI = join(__dirname, '..', 'dist', 'cli.js')
const FIXTURE = join(__dirname, 'fixtures', 'sample.pdf')

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

function run(args: string[], opts: SpawnOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI, ...args], { stdio: 'pipe', ...opts })
    let stdout = ''
    let stderr = ''
    child.stdout!.on('data', (b: Buffer) => (stdout += b.toString()))
    child.stderr!.on('data', (b: Buffer) => (stderr += b.toString()))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function tmpDir() {
  return mkdtemp(join(tmpdir(), 'scanlike-cli-'))
}

test('--help exits 0 and prints usage', async () => {
  const r = await run(['--help'])
  assert.equal(r.code, 0)
  assert.match(r.stdout, /Usage:/)
  assert.match(r.stdout, /scanlike/)
})

test('no args prints help and exits 0', async () => {
  const r = await run([])
  assert.equal(r.code, 0)
  assert.match(r.stdout, /Usage:/)
})

test('missing input file exits non-zero with clear error', async () => {
  const dir = await tmpDir()
  const r = await run([join(dir, 'does-not-exist.pdf'), '-o', join(dir, 'x.pdf')])
  assert.notEqual(r.code, 0)
  assert.match(r.stderr, /not found/)
})

test('missing -o flag exits non-zero', async () => {
  const r = await run([FIXTURE])
  assert.notEqual(r.code, 0)
  assert.match(r.stderr, /missing -o/)
})

test('writes a valid scanned PDF to .pdf path', async () => {
  const dir = await tmpDir()
  const out = join(dir, 'out.pdf')
  const r = await run([FIXTURE, '-o', out, '-q'])
  assert.equal(r.code, 0)
  const data = await readFile(out)
  const doc = await PDFDocument.load(data)
  assert.equal(doc.getPageCount(), 1)
})

test('writes per-page PNGs to a directory when -o ends in .png', async () => {
  const dir = await tmpDir()
  const out = join(dir, 'page.png')
  const r = await run([FIXTURE, '-o', out, '-q'])
  assert.equal(r.code, 0)
  const files = (await readdir(dir)).filter((f) => f.endsWith('.png'))
  assert.equal(files.length, 1)
  const buf = await readFile(join(dir, files[0]!))
  assert.equal(buf[0], 0x89)
  assert.equal(buf[1], 0x50)
})

test('writes per-page JPEGs when -o is a directory and --format jpeg', async () => {
  const dir = await tmpDir()
  const out = join(dir, 'pages')
  const r = await run([FIXTURE, '-o', out, '--format', 'jpeg', '-q'])
  assert.equal(r.code, 0)
  const files = await readdir(out)
  assert.ok(files.some((f) => f.endsWith('.jpg')))
})

test('--pages 1 produces exactly one image', async () => {
  const dir = await tmpDir()
  const out = join(dir, 'pages')
  const r = await run([FIXTURE, '-o', out, '--format', 'png', '--pages', '1', '-q'])
  assert.equal(r.code, 0)
  const files = await readdir(out)
  assert.equal(files.length, 1)
})

test('invalid --pages yields a clear error', async () => {
  const dir = await tmpDir()
  const r = await run([FIXTURE, '-o', join(dir, 'x.pdf'), '--pages', 'abc', '-q'])
  assert.notEqual(r.code, 0)
  assert.match(r.stderr, /pages/)
})

test('-q suppresses progress output on stderr', async () => {
  const dir = await tmpDir()
  const r = await run([FIXTURE, '-o', join(dir, 'q.pdf'), '-q'])
  assert.equal(r.code, 0)
  assert.equal(r.stderr.trim(), '')
})

test('non-quiet mode logs progress to stderr', async () => {
  const dir = await tmpDir()
  const r = await run([FIXTURE, '-o', join(dir, 'p.pdf')])
  assert.equal(r.code, 0)
  assert.match(r.stderr, /page 1\/1/)
})

test('output PDF is meaningfully sized (not a near-empty file)', async () => {
  const dir = await tmpDir()
  const out = join(dir, 'sized.pdf')
  const r = await run([FIXTURE, '-o', out, '-q'])
  assert.equal(r.code, 0)
  const s = await stat(out)
  assert.ok(s.size > 50_000, `expected > 50KB, got ${s.size}`)
})
