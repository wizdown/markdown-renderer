import type { PhrasingContent } from 'mdast'
import type { Diagnostic, IRBlock, IRInline, IRMeta, Origin, PromotableKind } from '../ir'
import type { MdNode } from '../sections'

export interface RuleContext {
  /**
   * True when the author asked for this shape explicitly. Rules skip their
   * heuristic gates when forced, but still validate that the content can
   * actually be expressed as the requested kind — an explicit `:::chart` over
   * a table of prose has to fail rather than render nonsense.
   */
  forced: boolean
  attributes: Record<string, string>
  blocks(nodes: readonly MdNode[]): IRBlock[]
  /**
   * Converts without promoting the *top-level* nodes (deeper levels still
   * infer). A rule that wraps its own input — `tree` keeps the original list
   * inside itself — must use this, or it would match itself forever.
   */
  plain(nodes: readonly MdNode[]): IRBlock[]
  inline(nodes: readonly PhrasingContent[]): IRInline[]
  meta(node: MdNode | undefined, origin: Origin): IRMeta
  warn(message: string, node?: MdNode): void
  diagnostics: Diagnostic[]
}

export interface RuleMatch {
  /** How many sibling nodes this promotion swallowed. */
  consumed: number
  node: IRBlock
}

export interface Rule {
  name: PromotableKind
  /**
   * Attempt a promotion starting at `nodes[index]`. Returning null means "not
   * this shape" and costs nothing — rules are tried in priority order until
   * one matches, and plain rendering is always the fallback.
   */
  match(nodes: readonly MdNode[], index: number, ctx: RuleContext): RuleMatch | null
}
