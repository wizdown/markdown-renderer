import { createContext, useContext, useMemo, type ElementType, type ReactNode } from 'react'

/**
 * Progressive reveal for deck mode.
 *
 * The keys come from the deck projection, and the components look them up by
 * the same `${blockId}` / `${blockId}:${index}` scheme the projection emits —
 * one source of truth, so the step count and what is actually on screen cannot
 * drift apart.
 *
 * Un-revealed content is dimmed rather than removed. It stays in the document
 * for screen readers and for Ctrl-F, and it keeps the panel's layout from
 * jumping as items appear, which is far more distracting to an audience than
 * seeing a faint upcoming bullet.
 */

interface RevealValue {
  active: boolean
  order: Map<string, number>
  step: number
}

const RevealContext = createContext<RevealValue>({
  active: false,
  order: new Map(),
  step: 0,
})

export function RevealProvider({
  keys,
  step,
  active,
  children,
}: {
  keys: readonly string[]
  step: number
  active: boolean
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ active, step, order: new Map(keys.map((key, index) => [key, index])) }),
    [keys, step, active],
  )
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>
}

export interface RevealState {
  /** True when this key is a step in the current panel's reveal order. */
  isStep: boolean
  /** True when it is a step that has not been reached yet. */
  pending: boolean
}

/**
 * Only keys the deck projection actually listed count as steps.
 *
 * Nested content carries reveal keys too — the list items inside a comparison
 * column, for instance — but the projection deliberately does not step through
 * them. Reporting `isStep` lets the renderer mark only the real steps in the
 * markup, which is what stops the exported file's script from counting the
 * nested ones and dimming an entire panel.
 */
export function useRevealState(key: string): RevealState {
  const { active, order, step } = useContext(RevealContext)
  const index = order.get(key)
  if (!active || index === undefined) return { isStep: false, pending: false }
  return { isStep: true, pending: index > step }
}

/** True when the key is not yet revealed. Always false outside deck mode. */
export function usePending(key: string): boolean {
  return useRevealState(key).pending
}

export function RevealItem({
  blockId,
  index,
  as,
  className,
  children,
}: {
  blockId: string
  index: number
  as?: ElementType
  className?: string
  children: ReactNode
}) {
  const key = `${blockId}:${index}`
  const { isStep, pending } = useRevealState(key)
  const Tag = as ?? 'div'
  return (
    <Tag
      className={[className, pending ? 'is-pending' : ''].filter(Boolean).join(' ')}
      aria-hidden={pending || undefined}
      {...(isStep ? { 'data-reveal': key } : {})}
    >
      {children}
    </Tag>
  )
}
