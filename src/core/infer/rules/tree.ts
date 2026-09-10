import type { List } from 'mdast'
import type { IRList } from '../../ir'
import type { Rule } from '../types'
import { hasTaskItems, listDepth } from '../helpers'

/**
 * Deeply nested lists become a collapsible outline.
 *
 * Three levels of bullets is where a list stops being scannable — and in deck
 * mode a four-level list simply will not fit on a panel. Collapsing the deep
 * levels keeps the top level readable and lets the reader open what they need.
 *
 * Task lists are excluded: a checklist's whole value is seeing every unchecked
 * box at once, which is precisely what collapsing takes away.
 */

const MIN_DEPTH = 3

export const treeRule: Rule = {
  name: 'tree',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'list') return null
    const list = node as List

    if (!ctx.forced) {
      if (listDepth(list) < MIN_DEPTH) return null
      if (hasTaskItems(list)) return null
    }

    const requested = Number(ctx.attributes.collapsebelow ?? ctx.attributes['collapse-below'])
    const collapseBelow = Number.isInteger(requested) && requested >= 1 ? requested : 2

    // plain(), not blocks(): converting through the rule runner would match
    // this same rule again and recurse without end.
    const [converted] = ctx.plain([node])
    if (converted === undefined || converted.type !== 'list') return null

    return {
      consumed: 1,
      node: {
        ...ctx.meta(node, ctx.forced ? 'explicit' : 'rule:tree'),
        type: 'tree',
        list: converted as IRList,
        collapseBelow,
      },
    }
  },
}
