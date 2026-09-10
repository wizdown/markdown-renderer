import type { IRDocument } from '../core/ir'

/**
 * The table of contents comes from the walk that built the IR, so it never
 * disagrees with the headings on screen and costs no second traversal.
 */
export function Toc({
  document,
  activeSlug,
  onNavigate,
}: {
  document: IRDocument
  activeSlug: string | null
  onNavigate: (slug: string) => void
}) {
  const entries = document.toc.filter((entry) => entry.depth <= 3)
  if (entries.length === 0) return null

  return (
    <nav className="toc" aria-label="Table of contents">
      <p className="toc-title">Contents</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.slug} data-depth={entry.depth}>
            <a
              href={`#${entry.slug}`}
              className={entry.slug === activeSlug ? 'is-active' : ''}
              onClick={(event) => {
                event.preventDefault()
                onNavigate(entry.slug)
              }}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
