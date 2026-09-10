import { useEffect, useMemo, useState } from 'react'
import type { IRCode } from '../../core/ir'
import { highlight } from './highlighter'
import { useStaticRender } from '../staticContext'

/**
 * Syntax highlighting is async (grammars load on demand) but the code must be
 * readable immediately, so the plain fence renders first and the highlighted
 * markup replaces it when it arrives. A failed or unknown language simply
 * stays plain — never an error, never an empty block.
 */
export function CodeBlock({ block }: { block: IRCode }) {
  const { isStatic, highlighted } = useStaticRender()
  // In a static render the markup was resolved before the render started, so
  // it is available on the first pass rather than after an effect.
  const [html, setHtml] = useState<string | null>(() => highlighted.get(block.id) ?? null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (isStatic || block.lang === null) {
      if (block.lang === null) setHtml(null)
      return
    }
    void highlight(block.value, block.lang, block.highlightLines).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => {
      cancelled = true
    }
  }, [block.value, block.lang, block.highlightLines, isStatic])

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
        {/* A copy button in a statically rendered file would need a script to
            do anything, and the reader can select the text regardless. */}
        {!isStatic && (
          <button type="button" className="code-copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {html === null ? (
        <pre className="code-block"><code>{block.value}</code></pre>
      ) : (
        <div className="code-block" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </figure>
  )
}
