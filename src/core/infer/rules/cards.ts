import type { List } from 'mdast'
import type { Rule } from '../types'
import { hasTaskItems, inlineText, listDepth, singleParagraphItem } from '../helpers'

/**
 * Short, flat, unordered lists become a card grid.
 *
 * The gates are all measurable: item count, item length, nesting depth. A list
 * of five one-liners is a set of parallel points and reads far better as a
 * grid; a list of five paragraphs is prose and must stay a list.
 */

const MIN_ITEMS = 3
const MAX_ITEMS = 6
const MAX_ITEM_CHARS = 80

function columnsFor(count: number): number {
  if (count <= 3) return count
  if (count % 3 === 0) return 3
  if (count % 2 === 0) return 2
  return 3
}

export const cardsRule: Rule = {
  name: 'cards',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'list') return null
    const list = node as List

    if (!ctx.forced) {
      if (list.ordered === true) return null
      if (list.children.length < MIN_ITEMS || list.children.length > MAX_ITEMS) return null
      if (hasTaskItems(list)) return null
      if (listDepth(list) > 1) return null

      for (const item of list.children) {
        const paragraph = singleParagraphItem(item)
        if (paragraph === null) return null
        if (inlineText(paragraph.children).trim().length > MAX_ITEM_CHARS) return null
      }
    }

    const requested = Number(ctx.attributes.columns)
    const columns = Number.isInteger(requested) && requested >= 1 && requested <= 4
      ? requested
      : columnsFor(list.children.length)

    return {
      consumed: 1,
      node: {
        ...ctx.meta(node, ctx.forced ? 'explicit' : 'rule:cards'),
        type: 'cards',
        columns,
        items: list.children.map((item) => ({ children: ctx.blocks(item.children) })),
      },
    }
  },
}
