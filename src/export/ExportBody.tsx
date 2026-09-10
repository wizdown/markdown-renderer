import type { IRDocument } from '../core/ir'
import { DocView } from '../render/DocView'
import { DeckExport } from '../render/DeckExport'
import { OverrideProvider } from '../render/OverrideChrome'

/**
 * What an exported file contains: both views, plus the small control bar its
 * script drives. The override chrome is off — an exported document is a
 * finished artefact, not an editing surface.
 */
export function ExportBody({ document }: { document: IRDocument }) {
  return (
    <OverrideProvider enabled={false} onOverride={() => {}}>
      <div className="export-shell">
        <header className="export-bar">
          <span className="export-title">{document.title ?? 'Document'}</span>
          <div className="export-actions">
            <span className="deck-position" data-role="position" />
            <button type="button" data-action="prev" aria-label="Previous panel">←</button>
            <button type="button" data-action="next" aria-label="Next panel">→</button>
            <button type="button" data-action="read">Read</button>
            <button type="button" data-action="present">Present</button>
            <button type="button" data-action="theme" aria-label="Toggle theme">◐</button>
          </div>
        </header>
        <main className="export-main">
          <DocView document={document} />
          <DeckExport document={document} />
        </main>
        <p className="export-hint">
          Press <kbd>P</kbd> to present, <kbd>←</kbd>/<kbd>→</kbd> to move, <kbd>F</kbd> for fullscreen.
        </p>
      </div>
    </OverrideProvider>
  )
}
