import { useEffect, useMemo, useState } from 'react'
import type { IRCode } from '../../core/ir'
import { highlight } from './highlighter'

/**
 * Syntax highlighting is async (grammars load on demand) but the code must be
 * readable immediately, so the plain fence renders first and the highlighted
 * markup replaces it when it arrives. A failed or unknown language simply
 * stays plain — never an error, never an empty block.
 */
export function CodeBlock({ block }: { block: IRCode }) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (block.lang === null) {
      setHtml(null)
      return
    }
    void highlight(block.value, block.lang, block.highlightLines).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => {
      cancelled = true
    }
  }, [block.value, block.lang, block.highlightLines])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const label = useMemo(() => block.title ?? block.lang ?? '', [block.title, block.lang])

  const copy = (): void => {
    void navigator.clipboard?.writeText(block.value).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <figure className="code-figure">
      <div className="code-bar">
        <span className="code-label">{label}</span>
        <button type="button" className="code-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html === null ? (
        <pre className="code-block"><code>{block.value}</code></pre>
      ) : (
        <div className="code-block" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </figure>
  )
}
