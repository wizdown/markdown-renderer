import { renderToStaticMarkup } from 'react-dom/server'
import type { IRDocument } from '../core/ir'
import { StaticRenderProvider } from '../render/staticContext'
import { ExportBody } from './ExportBody'
import { EXPORT_RUNTIME } from './runtime'
import { prehighlight, hasDiagrams } from './prehighlight'
import { APP_STYLES } from './styles'

/**
 * IR to a complete, self-contained HTML document — with no DOM involved.
 *
 * The browser export and this share every component, so the two cannot drift.
 * What differs is only how the asynchronous parts are resolved: the browser
 * lets them settle in a live document, and this resolves them up front and
 * renders in one pass.
 */

export interface StaticRenderOptions {
  /** Assembled CSS. Callers add inlined fonts before passing it in. */
  styles: string
  /** Inlined diagram runtime, if the output is to carry one. */
  diagramRuntime?: string | null
  title?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * `</script>` inside a script body ends the block wherever it appears, even in
 * a string literal — so any bundled runtime has to have it broken up.
 */
function escapeScript(source: string): string {
  return source.replace(/<\/(script)/gi, '<\\/$1')
}

const DIAGRAM_BOOTSTRAP = `
(function () {
  if (typeof mermaid === 'undefined') return
  var root = document.documentElement
  function draw() {
    var dark = root.getAttribute('data-theme') === 'dark'
      || (!root.getAttribute('data-theme')
          && window.matchMedia('(prefers-color-scheme: dark)').matches)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default'
    })
    mermaid.run({ querySelector: '.mermaid' })
  }
  draw()
  // Re-draw on a theme change: mermaid bakes colours into the SVG it emits,
  // so a theme swap needs a fresh render rather than a CSS change.
  new MutationObserver(function () {
    document.querySelectorAll('.mermaid[data-processed]').forEach(function (node) {
      node.removeAttribute('data-processed')
      node.innerHTML = node.getAttribute('data-source') || node.textContent
    })
    draw()
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
})()
`

export async function renderStaticDocument(
  document: IRDocument,
  options: StaticRenderOptions,
): Promise<string> {
  const highlighted = await prehighlight(document)
  const diagramRuntime = options.diagramRuntime ?? null

  // Deliberately no ThemeProvider: it reads localStorage and matchMedia on
  // mount, neither of which exists in Node. The exported file gets its theme
  // from CSS media queries and the `data-theme` toggle in its own script, so
  // the default context value is exactly right here.
  const body = renderToStaticMarkup(
    <StaticRenderProvider
      value={{ isStatic: true, highlighted, diagramRuntime: diagramRuntime !== null }}
    >
      <ExportBody document={document} />
    </StaticRenderProvider>,
  )

  const title = options.title ?? document.title ?? 'Document'

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${options.styles}</style>`,
    '</head>',
    '<body class="exported">',
    body,
    diagramRuntime === null
      ? ''
      : `<script>${escapeScript(diagramRuntime)}</script>\n<script>${DIAGRAM_BOOTSTRAP}</script>`,
    `<script>${EXPORT_RUNTIME}</script>`,
    '</body>',
    '</html>',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export { APP_STYLES, hasDiagrams }
