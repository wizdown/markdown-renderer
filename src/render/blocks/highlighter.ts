import type { Highlighter } from 'shiki'

/**
 * One highlighter for the whole app, created on first use and shared after.
 *
 * Both themes are baked into the output as CSS custom properties
 * (`--shiki-light` / `--shiki-dark`) so switching theme is a CSS swap rather
 * than a re-highlight — which matters in deck mode, where re-tokenising every
 * fence on a theme change would stutter mid-presentation.
 */

let highlighterPromise: Promise<Highlighter> | null = null
const loaded = new Set<string>()

async function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise === null) {
    highlighterPromise = import('shiki').then((shiki) =>
      shiki.createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] }),
    )
  }
  return highlighterPromise
}

export async function highlight(
  code: string,
  lang: string,
  highlightLines: readonly number[],
): Promise<string | null> {
  try {
    const highlighter = await getHighlighter()

    if (!loaded.has(lang)) {
      const bundled = await import('shiki/langs')
      if (!(lang in bundled.bundledLanguages)) return null
      await highlighter.loadLanguage(lang as never)
      loaded.add(lang)
    }

    const marked = new Set(highlightLines)
    return highlighter.codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      transformers: [
        {
          line(node, line) {
            if (marked.has(line)) this.addClassToHast(node, 'line-highlight')
          },
        },
      ],
    })
  } catch {
    // An unknown language or a grammar that fails to load is not an error the
    // reader should ever see; the plain fence is a perfectly good fallback.
    return null
  }
}
