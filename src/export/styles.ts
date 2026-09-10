import themeCss from '../styles/theme.css?raw'
import docCss from '../styles/doc.css?raw'
import deckCss from '../styles/deck.css?raw'
import appCss from '../styles/app.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'

/**
 * The stylesheet an exported file carries, assembled from source rather than
 * scraped out of a live document.
 *
 * The browser export reads `document.styleSheets`, which only works because it
 * runs inside the running app. Building the same sheet from the source files
 * is what lets the command-line renderer produce an identical file with no
 * browser anywhere in the process.
 */
export const APP_STYLES = [themeCss, docCss, deckCss, appCss].join('\n')

export const KATEX_STYLES = katexCss

/** Font files katex.min.css refers to, relative to `katex/dist/`. */
export function katexFontReferences(): string[] {
  const references = new Set<string>()
  for (const [, url] of katexCss.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/gi)) {
    if (url !== undefined) references.add(url)
  }
  return [...references]
}

/** Rewrites `url(fonts/X.woff2)` to the data URIs supplied by the caller. */
export function inlineKatexFonts(css: string, fonts: ReadonlyMap<string, string>): string {
  return css.replace(
    /url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/gi,
    (whole, reference: string) => {
      const data = fonts.get(reference)
      return data === undefined ? whole : `url("${data}")`
    },
  )
}
