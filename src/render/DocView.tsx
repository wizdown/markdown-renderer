import { forwardRef } from 'react'
import type { IRDocument } from '../core/ir'
import { Blocks } from './Block'
import { Inline } from './Inline'
import { RevealProvider } from './reveal'

/**
 * Reading mode: one scroll, generous measure, everything on the page at once.
 * The reveal provider is present but inactive, so the same components render
 * here and in deck mode without branching.
 */
export const DocView = forwardRef<HTMLDivElement, { document: IRDocument }>(
  function DocView({ document }, ref) {
    return (
      <RevealProvider keys={[]} step={0} active={false}>
        <article className="doc" ref={ref}>
          <Blocks blocks={document.children} />

          {document.footnotes.length > 0 && (
            <section className="footnotes" aria-labelledby="footnotes-heading">
              <h2 id="footnotes-heading">Notes</h2>
              <ol>
                {document.footnotes.map((footnote) => (
                  <li key={footnote.id} id={`fn-${footnote.identifier}`}>
                    <Blocks blocks={footnote.children} />
                    <a className="footnote-back" href={`#fnref-${footnote.identifier}`}
                      aria-label="Back to reference">↩</a>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </article>
      </RevealProvider>
    )
  },
)

export function DocTitle({ document }: { document: IRDocument }) {
  const heading = document.children.find(
    (block) => block.type === 'section' && block.depth === 1,
  )
  if (heading === undefined || heading.type !== 'section') return null
  return <Inline nodes={heading.heading.children} />
}
