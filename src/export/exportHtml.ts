import { createRoot } from 'react-dom/client'
import { createElement, StrictMode } from 'react'
import type { IRDocument } from '../core/ir'
import { EXPORT_RUNTIME } from './runtime'
import { ExportBody } from './ExportBody'

/**
 * A single self-contained HTML file: no server, no network, no build step.
 *
 * This is the sharing story. A rendered document that only exists inside a dev
 * server is not something you can hand to anyone, and a deck you cannot open
 * on the conference-room laptop is not a deck.
 *
 * The approach is to render both views into an offscreen root, wait for the
 * asynchronous pieces (syntax highlighting, diagrams, web fonts) to resolve,
 * then serialize the resulting DOM together with the page's own stylesheets.
 * Serializing settled DOM rather than re-implementing the renderer for strings
 * is what keeps the export identical to what the reader just saw.
 */

const SETTLE_TIMEOUT_MS = 6000
const SETTLE_POLL_MS = 60

/**
 * A paint tick that also resolves in a background tab.
 *
 * `requestAnimationFrame` never fires while the page is hidden, so waiting on
 * it alone hangs the export whenever the user switches away mid-export — which
 * is exactly when a slow export is most likely. Racing it against a timer keeps
 * the settle loop progressing either way.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      resolve()
    }
    requestAnimationFrame(finish)
    setTimeout(finish, 32)
  })
}

/** True once nothing on the page is still waiting to render itself. */
function isSettled(container: HTMLElement): boolean {
  if (container.querySelector('.mermaid-loading') !== null) return false
  // A fence with a language renders plain first and is replaced by highlighted
  // markup; `pre.code-block` means that swap has not happened yet.
  if (container.querySelector('.code-figure pre.code-block') !== null) {
    const pending = container.querySelectorAll('.code-figure pre.code-block')
    for (const node of pending) {
      const label = node.parentElement?.querySelector('.code-label')?.textContent ?? ''
      if (label !== '') return false
    }
  }
  return true
}

async function waitForSettle(container: HTMLElement): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS
  try {
    await window.document.fonts?.ready
  } catch {
    // Font loading is best-effort; the export still works without it.
  }
  while (Date.now() < deadline) {
    await nextFrame()
    if (isSettled(container)) return
    await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS))
  }
  // Timing out is not a failure: whatever has not resolved falls back to its
  // plain form, which is exactly what the reader would have seen anyway.
}

/**
 * Anything still mid-render when the settle loop gives up is replaced by its
 * source. Shipping a file that says "Rendering diagram…" for ever is the one
 * outcome worse than showing the author's mermaid: the reader cannot tell
 * whether the diagram is slow, broken, or was never there.
 */
function degradeUnsettled(container: HTMLElement): void {
  for (const figure of container.querySelectorAll('.mermaid-figure')) {
    if (figure.querySelector('.mermaid-loading') === null) continue

    const source = figure.getAttribute('data-mermaid-source') ?? ''
    const fallback = window.document.createElement('figure')
    fallback.className = 'code-figure'

    const bar = window.document.createElement('div')
    bar.className = 'code-bar'
    const label = window.document.createElement('span')
    label.className = 'code-label'
    label.textContent = 'mermaid'
    bar.appendChild(label)

    const pre = window.document.createElement('pre')
    pre.className = 'code-block'
    const code = window.document.createElement('code')
    code.textContent = source
    pre.appendChild(code)

    fallback.append(bar, pre)
    figure.replaceWith(fallback)
  }
}

/**
 * Every rule from every stylesheet the app loaded, flattened into one string.
 * Cross-origin sheets throw on `cssRules` — there are none here, but a browser
 * extension can inject one, and that must not take the export down.
 */
function collectStyles(): string {
  const chunks: string[] = []
  for (const sheet of Array.from(window.document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText)
    } catch {
      continue
    }
  }
  return chunks.join('\n')
}

/**
 * Font files referenced by the collected CSS, inlined as data URIs.
 *
 * KaTeX ships its glyphs as separate font files and points at them with
 * relative paths. Those paths resolve against wherever the exported file ends
 * up, so an export that leaves them alone renders its maths in a fallback face
 * the moment the file is moved off the dev server — which is the entire point
 * of exporting it.
 *
 * Only `woff2` is inlined. Every browser that can open this file supports it,
 * and pulling the `woff`/`ttf` fallbacks too would triple the payload for
 * nothing; the browser picks the first format it understands.
 */
const MAX_INLINED_FONT_BYTES = 3_000_000

async function inlineFonts(css: string): Promise<string> {
  const references = new Set<string>()
  for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/gi)) {
    if (url !== undefined && !url.startsWith('data:')) references.add(url)
  }
  if (references.size === 0) return css

  let budget = MAX_INLINED_FONT_BYTES
  const replacements = new Map<string, string>()

  await Promise.all(
    [...references].map(async (reference) => {
      try {
        const response = await fetch(new URL(reference, window.document.baseURI))
        if (!response.ok) return
        const buffer = await response.arrayBuffer()
        if (buffer.byteLength > budget) return
        budget -= buffer.byteLength
        replacements.set(reference, `data:font/woff2;base64,${toBase64(buffer)}`)
      } catch {
        // A font that will not load is a cosmetic loss, not a failed export.
      }
    }),
  )

  return css.replace(
    /url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/gi,
    (whole, reference: string) => {
      const inlined = replacements.get(reference)
      return inlined === undefined ? whole : `url("${inlined}")`
    },
  )
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunked so a large font does not blow the argument limit of String.fromCharCode.
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function exportDocument(document: IRDocument): Promise<string> {
  const host = window.document.createElement('div')
  // Offscreen but laid out: `display: none` would leave every measured element
  // at zero size and the diagrams unrendered.
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px;pointer-events:none'
  window.document.body.appendChild(host)

  const root = createRoot(host)
  try {
    root.render(createElement(StrictMode, null, createElement(ExportBody, { document })))
    await waitForSettle(host)
    degradeUnsettled(host)

    const title = document.title ?? 'Document'
    const styles = await inlineFonts(collectStyles())

    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(title)}</title>`,
      `<style>${styles}</style>`,
      '</head>',
      '<body class="exported">',
      host.innerHTML,
      `<script>${EXPORT_RUNTIME}</script>`,
      '</body>',
      '</html>',
    ].join('\n')
  } finally {
    root.unmount()
    host.remove()
  }
}

/** Hands the finished file to the browser as a download. */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
