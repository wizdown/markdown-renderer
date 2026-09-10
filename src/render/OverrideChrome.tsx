import { createContext, useContext, useState, type ReactNode } from 'react'
import { PROMOTABLE, type IRBlock } from '../core/ir'
import type { HintKind } from '../core/hints'

/**
 * The inspect-and-correct affordance.
 *
 * A heuristic that cannot be corrected is a liability: a wrong rendering is
 * harder to see through than a plain one, because the reader cannot tell what
 * the source actually said. So every promoted block wears a chip naming the
 * rule that produced it, and the chip opens a menu that writes the correction
 * back into the markdown.
 */

interface OverrideValue {
  enabled: boolean
  onOverride: (block: IRBlock, kind: HintKind | null) => void
}

const OverrideContext = createContext<OverrideValue>({ enabled: false, onOverride: () => {} })

export function OverrideProvider({
  enabled,
  onOverride,
  children,
}: OverrideValue & { children: ReactNode }) {
  return (
    <OverrideContext.Provider value={{ enabled, onOverride }}>{children}</OverrideContext.Provider>
  )
}

const LABELS: Record<string, string> = {
  cards: 'Card grid',
  stepper: 'Steps',
  callout: 'Callout',
  chart: 'Chart',
  comparison: 'Columns',
  definitions: 'Definitions',
  tree: 'Outline',
  prose: 'Plain markdown',
}

function ruleName(block: IRBlock): string {
  if (block.origin === 'explicit') return 'set by author'
  return block.origin.startsWith('rule:') ? block.origin.slice(5) : block.origin
}

export function OverrideChrome({ block, children }: { block: IRBlock; children: ReactNode }) {
  const { enabled, onOverride } = useContext(OverrideContext)
  const [open, setOpen] = useState(false)

  const promoted = block.origin === 'explicit' || block.origin.startsWith('rule:')
  if (!enabled || !promoted || block.source === undefined) return <>{children}</>

  return (
    <div className={`chrome${open ? ' is-open' : ''}`}>
      <div className="chrome-bar">
        <button
          type="button"
          className="chrome-chip"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          title={`Rendered as ${block.type} (${ruleName(block)}) — click to change`}
        >
          {LABELS[block.type] ?? block.type}
          <span className="chrome-origin">{ruleName(block)}</span>
          <span aria-hidden>▾</span>
        </button>
      </div>

      {open && (
        <div className="chrome-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOverride(block, 'prose')
              setOpen(false)
            }}
          >
            {LABELS.prose}
          </button>
          {PROMOTABLE.filter((kind) => kind !== block.type).map((kind) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                onOverride(block, kind)
                setOpen(false)
              }}
            >
              {LABELS[kind] ?? kind}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="chrome-reset"
            onClick={() => {
              onOverride(block, null)
              setOpen(false)
            }}
          >
            Reset to automatic
          </button>
        </div>
      )}

      {children}
    </div>
  )
}
