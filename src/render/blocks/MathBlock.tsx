import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * KaTeX renders synchronously and ships its own fonts, so math works offline
 * and in the static export with no network round-trip.
 */
function render(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: 'ignore',
    })
  } catch {
    return ''
  }
}

export function InlineMath({ value }: { value: string }) {
  const html = useMemo(() => render(value, false), [value])
  return html === ''
    ? <code className="inline-code">{value}</code>
    : <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
}

export function MathBlock({ value }: { value: string }) {
  const html = useMemo(() => render(value, true), [value])
  return html === ''
    ? <pre className="code-block"><code>{value}</code></pre>
    : <div className="math-block" dangerouslySetInnerHTML={{ __html: html }} />
}
