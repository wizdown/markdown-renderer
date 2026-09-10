import type { PromotableKind } from '../ir'
import type { Rule, RuleContext, RuleMatch } from './types'
import type { MdNode } from '../sections'
import { calloutRule } from './rules/callout'
import { definitionsRule } from './rules/definitions'
import { chartRule } from './rules/chart'
import { comparisonRule } from './rules/comparison'
import { treeRule } from './rules/tree'
import { stepperRule } from './rules/stepper'
import { cardsRule } from './rules/cards'

/**
 * Rule order is priority order — the first match wins and nothing after it is
 * tried. Two orderings actually matter:
 *
 *   definitions before cards — term/description pairs also pass the card
 *     gates, and collapsing them into plain cards loses real structure.
 *   tree before cards        — belt and braces; cards already reject nesting.
 *
 * The rest are disjoint by node type and could be listed in any order.
 */
export const RULES: readonly Rule[] = [
  calloutRule,
  comparisonRule,
  chartRule,
  definitionsRule,
  treeRule,
  stepperRule,
  cardsRule,
]

const BY_NAME = new Map<PromotableKind, Rule>(RULES.map((rule) => [rule.name, rule]))

/** Try every rule in priority order. Returns null to mean "render as prose". */
export function runRules(
  nodes: readonly MdNode[],
  index: number,
  ctx: RuleContext,
): RuleMatch | null {
  for (const rule of RULES) {
    const match = rule.match(nodes, index, ctx)
    if (match !== null) return match
  }
  return null
}

/**
 * Run one named rule with its heuristic gates disabled, for `:::cards` and
 * `<!-- render: cards -->`. It can still fail — an explicit `chart` over a
 * table of prose has nothing to plot — in which case the caller falls back to
 * plain rendering and records a diagnostic.
 */
export function forceRule(
  name: PromotableKind,
  nodes: readonly MdNode[],
  index: number,
  ctx: RuleContext,
): RuleMatch | null {
  return BY_NAME.get(name)?.match(nodes, index, { ...ctx, forced: true }) ?? null
}

export { type Rule, type RuleContext, type RuleMatch } from './types'
