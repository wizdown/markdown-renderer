import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IRDocument } from '../core/ir'
import { buildDeck } from '../core/deck'
import { Blocks } from './Block'
import { Inline } from './Inline'
import { RevealProvider } from './reveal'

/**
 * Presentation mode.
 *
 * This is a projection of the same IR the document renders from — no second
 * parse, no slide-shaped source. That is the whole point of the split: the
 * author writes ordinary markdown and gets both.
 *
 * Panels scale their type to the viewport rather than to a fixed slide size,
 * so a projector, a laptop and a phone all get something readable instead of
 * a shrunk-to-fit 4:3 rectangle.
 */

export interface DeckViewProps {
  document: IRDocument
  /** Lets the toolbar and the doc/deck switch drive the same position. */
  panelIndex: number
  onPanelChange: (index: number) => void
  onExit: () => void
}

export function DeckView({ document, panelIndex, onPanelChange, onExit }: DeckViewProps) {
  const deck = useMemo(() => buildDeck(document), [document])
  const [step, setStep] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const index = Math.min(Math.max(0, panelIndex), deck.panels.length - 1)
  const panel = deck.panels[index]
  const totalSteps = panel?.revealKeys.length ?? 0

  // Landing on a panel always starts it fully collapsed, including when the
  // reader arrives backwards — in which case they want it fully revealed.
  const goTo = useCallback(
    (nextIndex: number, atEnd: boolean) => {
      const clamped = Math.min(Math.max(0, nextIndex), deck.panels.length - 1)
      const target = deck.panels[clamped]
      onPanelChange(clamped)
      setStep(atEnd ? Math.max(0, (target?.revealKeys.length ?? 1) - 1) : 0)
    },
    [deck.panels, onPanelChange],
  )

  const advance = useCallback(() => {
    if (step < totalSteps - 1) setStep((value) => value + 1)
    else if (index < deck.panels.length - 1) goTo(index + 1, false)
  }, [step, totalSteps, index, deck.panels.length, goTo])

  const retreat = useCallback(() => {
    if (step > 0) setStep((value) => value - 1)
    else if (index > 0) goTo(index - 1, true)
  }, [step, index, goTo])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          event.preventDefault()
          advance()
          break
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          retreat()
          break
        case 'ArrowDown':
          event.preventDefault()
          goTo(index + 1, false)
          break
        case 'ArrowUp':
          event.preventDefault()
          goTo(index - 1, false)
          break
        case 'Home':
          event.preventDefault()
          goTo(0, false)
          break
        case 'End':
          event.preventDefault()
          goTo(deck.panels.length - 1, false)
          break
        case 'f':
          event.preventDefault()
          void toggleFullscreen(containerRef.current)
          break
        case 'Escape':
          if (window.document.fullscreenElement === null) onExit()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, retreat, goTo, index, deck.panels.length, onExit])

  if (panel === undefined) return null

  return (
    <div className="deck" ref={containerRef}>
      <RevealProvider keys={panel.revealKeys} step={step} active>
        <section
          className="panel"
          key={panel.id}
          aria-roledescription="slide"
          aria-label={`Panel ${index + 1} of ${deck.panels.length}`}
        >
          {panel.title !== null && (
            <h2 className="panel-title" id={panel.slug ?? undefined}>
              <Inline nodes={panel.title} />
            </h2>
          )}
          <div className="panel-body">
            <Blocks blocks={panel.blocks} />
          </div>
        </section>
      </RevealProvider>

      <div className="deck-controls">
        <button type="button" onClick={retreat} disabled={index === 0 && step === 0}
          aria-label="Previous">←</button>
        <span className="deck-position">
          {index + 1} / {deck.panels.length}
          {totalSteps > 1 && <span className="deck-step"> · {step + 1}/{totalSteps}</span>}
        </span>
        <button
          type="button"
          onClick={advance}
          disabled={index === deck.panels.length - 1 && step >= totalSteps - 1}
          aria-label="Next"
        >
          →
        </button>
      </div>

      <div className="deck-progress" aria-hidden>
        <div
          className="deck-progress-fill"
          style={{ width: `${((index + 1) / deck.panels.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

async function toggleFullscreen(element: HTMLElement | null): Promise<void> {
  try {
    if (window.document.fullscreenElement !== null) await window.document.exitFullscreen()
    else await element?.requestFullscreen()
  } catch {
    // Fullscreen is a nicety; a browser that refuses it changes nothing else.
  }
}
