import type { List } from 'mdast'
import type { Rule } from '../types'
import { blockText, isParagraph, listDepth } from '../helpers'

/**
 * Ordered lists become a numbered stepper.
 *
 * Note what this rule does *not* do: it makes no attempt to decide whether the
 * items are imperative instructions. That needs reading comprehension, which
 * this renderer does not have and must not require. Uniform shape and an
 * explicit ordering are the whole signal — which is fine, because a stepper is
 * a reasonable rendering for any ordered list of comparable steps.
 */

const MIN_ITEMS = 3
const MAX_ITEM_CHARS = 400

export const stepperRule: Rule = {
  name: 'stepper',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'list') return null
    const list = node as List

    if (!ctx.forced) {
      if (list.ordered !== true) return null
      if (list.children.length < MIN_ITEMS) return null
      if (listDepth(list) > 2) return null

      for (const item of list.children) {
        // Uniform shape: every step opens with prose, not a bare code block or
        // a nested list. Mixed shapes look broken in a stepper's fixed layout.
        if (!isParagraph(item.children[0])) return null
        if (blockText(item.children).length > MAX_ITEM_CHARS) return null
      }
    }

    return {
      consumed: 1,
      node: {
        ...ctx.meta(node, ctx.forced ? 'explicit' : 'rule:stepper'),
        type: 'stepper',
        start: list.start ?? 1,
        items: list.children.map((item) => ({ children: ctx.blocks(item.children) })),
      },
    }
  },
}
