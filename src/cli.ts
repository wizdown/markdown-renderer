import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, extname, resolve } from 'node:path'
import { renderToIR } from './core/toIR'
import { renderStaticDocument } from './export/renderStatic'
import {
  APP_STYLES,
  KATEX_STYLES,
  inlineKatexFonts,
  katexFontReferences,
} from './export/styles'
import { hasDiagrams } from './export/prehighlight'

/**
 * mdr — render a markdown file to one self-contained HTML file.
 *
 * Everything the output needs is inlined: markup, styles, highlighted code,
 * maths fonts and, when the document has diagrams, the diagram runtime. The
 * result opens from a filesystem with no server, no network and no install,
 * which is the point — the file is the thing you share, not this tool.
 */

const USAGE = `mdr — render markdown as a document you can also present

Usage
  mdr <file.md> [options]

Options
  -o, --out <file>       Output path (default: alongside the input, as .html)
      --title <text>     Override the document title
      --diagrams         Inline the diagram runtime so mermaid draws itself.
                         Costs about 3.4 MB; without it diagrams show their
                         source. The app's Export button pre-renders them to
                         SVG instead, for a far smaller file.
      --stdout           Write to stdout instead of a file
  -h, --help             Show this
  -v, --version          Show the version

Reading the result
  Open it in any browser. Press P to present, arrows to move, F for fullscreen.
`

interface Options {
  input: string | null
  out: string | null
  title: string | null
  diagrams: boolean
  stdout: boolean
  help: boolean
  version: boolean
}

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    input: null,
    out: null,
    title: null,
    diagrams: false,
    stdout: false,
    help: false,
    version: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true
        break
      case '-v':
      case '--version':
        options.version = true
        break
      case '--stdout':
        options.stdout = true
        break
      case '--diagrams':
        options.diagrams = true
        break
      case '--no-diagrams':
        options.diagrams = false
        break
      case '-o':
      case '--out':
        index += 1
        options.out = argv[index] ?? null
        break
      case '--title':
        index += 1
        options.title = argv[index] ?? null
        break
      default:
        if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
        if (options.input !== null) throw new Error('Only one input file is supported')
        options.input = arg
    }
  }

  return options
}

/**
 * KaTeX ships its glyphs as separate font files and points at them with
 * relative paths, which resolve against wherever the output file ends up. They
 * have to travel inside the file or the maths renders in a fallback face the
 * moment it is moved.
 */
async function katexStyles(): Promise<string> {
  try {
    const require = createRequire(import.meta.url)
    const fontsRoot = dirname(require.resolve('katex/dist/katex.min.css'))

    const fonts = new Map<string, string>()
    await Promise.all(
      katexFontReferences().map(async (reference) => {
        const file = await readFile(resolve(fontsRoot, reference))
        fonts.set(reference, `data:font/woff2;base64,${file.toString('base64')}`)
      }),
    )
    return inlineKatexFonts(KATEX_STYLES, fonts)
  } catch {
    // Without the fonts maths still renders, just with fallback metrics. That
    // is a cosmetic loss and not worth failing the whole render over.
    return KATEX_STYLES
  }
}

/**
 * mermaid's self-contained build, for `--diagrams`.
 *
 * It is about 3.4 MB and there is no smaller option: the ESM entry lazy-loads
 * its diagram types by relative path, which cannot work from an inline script,
 * and bundling from source saves nothing because mermaid registers every
 * diagram type eagerly. Hence the opt-in — a nine-fold jump in file size for
 * one flowchart should be the author's decision, not a surprise.
 */
async function diagramRuntime(): Promise<string | null> {
  try {
    const require = createRequire(import.meta.url)
    return await readFile(require.resolve('mermaid/dist/mermaid.min.js'), 'utf8')
  } catch {
    return null
  }
}

function outputPathFor(input: string, out: string | null): string {
  if (out !== null) return resolve(out)
  const name = basename(input, extname(input))
  return resolve(dirname(input), `${name}.html`)
}

export async function run(argv: readonly string[]): Promise<number> {
  let options: Options
  try {
    options = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`)
    return 2
  }

  if (options.help) {
    process.stdout.write(USAGE)
    return 0
  }
  if (options.version) {
    process.stdout.write(`${__MDR_VERSION__}\n`)
    return 0
  }
  if (options.input === null) {
    process.stderr.write(USAGE)
    return 2
  }

  const inputPath = resolve(options.input)
  let source: string
  try {
    source = await readFile(inputPath, 'utf8')
  } catch {
    process.stderr.write(`Cannot read ${options.input}\n`)
    return 1
  }

  const document = renderToIR(source)
  const wantsDiagrams = options.diagrams && hasDiagrams(document)

  const html = await renderStaticDocument(document, {
    styles: `${await katexStyles()}\n${APP_STYLES}`,
    diagramRuntime: wantsDiagrams ? await diagramRuntime() : null,
    title: options.title,
  })

  if (options.stdout) {
    process.stdout.write(html)
    return 0
  }

  const outputPath = outputPathFor(inputPath, options.out)
  await writeFile(outputPath, html, 'utf8')

  const kilobytes = Math.round(Buffer.byteLength(html) / 1024)
  process.stderr.write(`${outputPath}  ${kilobytes} KB\n`)

  for (const diagnostic of document.diagnostics) {
    process.stderr.write(`  ${diagnostic.level}: ${diagnostic.message}\n`)
  }
  if (wantsDiagrams) {
    process.stderr.write('  note: diagram runtime inlined (~3.4 MB)\n')
  } else if (hasDiagrams(document)) {
    process.stderr.write(
      '  note: diagrams shown as source. --diagrams inlines the runtime (~3.4 MB),\n'
      + '        or use the app\'s Export button to pre-render them to SVG.\n',
    )
  }

  return 0
}
