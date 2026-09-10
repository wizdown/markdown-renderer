import { createContext, useContext, type ReactNode } from 'react'

/**
 * Static rendering mode.
 *
 * `react-dom/server` renders in one synchronous pass: no effects run, so the
 * components that normally resolve themselves asynchronously — syntax
 * highlighting, diagrams — have nothing to resolve them. Anything they need
 * must therefore be computed *before* the render and handed in here.
 *
 * This is what lets one set of components serve the live app, the browser
 * export and the command-line renderer, instead of maintaining a second
 * implementation for strings.
 */

export interface StaticRenderValue {
  /** True while rendering to a string rather than into a live document. */
  isStatic: boolean
  /** Highlighted markup per code-block id, resolved ahead of the render. */
  highlighted: ReadonlyMap<string, string>
  /**
   * Whether the output will carry a diagram runtime. When false, a diagram
   * degrades to its source rather than to a box that never fills in.
   */
  diagramRuntime: boolean
}

const StaticRenderContext = createContext<StaticRenderValue>({
  isStatic: false,
  highlighted: new Map(),
  diagramRuntime: false,
})

export function StaticRenderProvider({
  value,
  children,
}: {
  value: StaticRenderValue
  children: ReactNode
}) {
  return <StaticRenderContext.Provider value={value}>{children}</StaticRenderContext.Provider>
}

export function useStaticRender(): StaticRenderValue {
  return useContext(StaticRenderContext)
}
