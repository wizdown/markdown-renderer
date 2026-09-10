import { useMemo } from 'react'
import type { IRDocument } from '../core/ir'
import { buildDeck } from '../core/deck'
import { Blocks } from './Block'
import { Inline } from './Inline'
import { RevealProvider } from './reveal'

/**
 * Every deck panel, rendered at once, for the static export.
 *
 * The exported file's script only shows and hides these — it contains no idea
 * of what a panel is or where one ends. All of that stays in buildDeck, so the
 * export cannot drift from the app.
 */
export function DeckExport({ document }: { document: IRDocument }) {
  const deck = useMemo(() => buildDeck(document), [document])

  return (
    <div className="deck-export" data-panel-count={deck.panels.length}>
      {deck.panels.map((panel, index) => (
        <RevealProvider key={panel.id} keys={panel.revealKeys} step={Number.MAX_SAFE_INTEGER} active>
          <section
            className="panel"
            data-panel={index}
            aria-roledescription="slide"
            aria-label={`Panel ${index + 1} of ${deck.panels.length}`}
          >
            {panel.title !== null && (
              <h2 className="panel-title"><Inline nodes={panel.title} /></h2>
            )}
            <div className="panel-body">
              <Blocks blocks={panel.blocks} />
            </div>
          </section>
        </RevealProvider>
      ))}
    </div>
  )
}
