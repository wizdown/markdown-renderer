import type { List, PhrasingContent } from 'mdast'
import type { IRDefinitionListItem } from '../../ir'
import type { Rule } from '../types'
import { hasTaskItems, inlineText, listDepth, singleParagraphItem } from '../helpers'

/**
 * `- **Term** — description` lists, rendered as definition cards.
 *
 * This must be tried before the card-grid rule: term/description pairs satisfy
 * the card gates too, and losing the term/description distinction is a
 * strictly worse rendering.
 *
 * The gates are lexical, not semantic. A term is short, unpunctuated, and
 * separated from its description by a dash or colon — that is all we can know
 * without reading for meaning, so anything looser stays a plain list.
 */

const SEPARATOR_RE = /^\s*(?:—|–|-{1,2}|:)\s+/
const TERM_MAX_WORDS = 6
const TERM_MAX_CHARS = 48

interface Split {
  term: PhrasingContent[]
  description: PhrasingContent[]
}

function plausibleTerm(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed.length > TERM_MAX_CHARS) return false
  if (trimmed.split(/\s+/).length > TERM_MAX_WORDS) return false
  // A term is a label, not a sentence.
  return !/[.!?,;]$/.test(trimmed)
}

/** `**Term** — description`: the strongest signal, and the common case. */
function splitOnStrong(children: readonly PhrasingContent[]): Split | null {
  const [first, second] = children
  if (first?.type !== 'strong' && first?.type !== 'emphasis') return null
  if (!plausibleTerm(inlineText(first.children))) return null

  if (second?.type !== 'text') return null
  const match = SEPARATOR_RE.exec(second.value)
  if (match === null) return null

  const remainder = second.value.slice(match[0].length)
  const description: PhrasingContent[] = []
  if (remainder !== '') description.push({ type: 'text', value: remainder })
  description.push(...children.slice(2))
  if (description.length === 0) return null

  return { term: first.children, description }
}

/** `Term — description` in plain text, with no bold to lean on. */
function splitOnText(children: readonly PhrasingContent[]): Split | null {
  const [first] = children
  if (first?.type !== 'text') return null

  const match = /^([^—–:\n]{1,48}?)\s*(?:—|–|\s-\s|:)\s+(.*)$/s.exec(first.value)
  if (match === null) return null
  const term = match[1] ?? ''
  if (!plausibleTerm(term)) return null

  const description: PhrasingContent[] = []
  const rest = (match[2] ?? '').trim()
  if (rest !== '') description.push({ type: 'text', value: rest })
  description.push(...children.slice(1))
  if (description.length === 0) return null

  return { term: [{ type: 'text', value: term.trim() }], description }
}

export const definitionsRule: Rule = {
  name: 'definitions',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'list') return null
    const list = node as List

    if (!ctx.forced) {
      if (list.ordered === true) return null
      if (list.children.length < 2) return null
      if (hasTaskItems(list)) return null
      if (listDepth(list) > 1) return null
    }

    const items: IRDefinitionListItem[] = []
    for (const item of list.children) {
      const paragraph = singleParagraphItem(item)
      if (paragraph === null) return null
      const split = splitOnStrong(paragraph.children) ?? splitOnText(paragraph.children)
      if (split === null) return null
      items.push({
        term: ctx.inline(split.term),
        description: ctx.inline(split.description),
      })
    }

    if (items.length < 2) return null

    return {
      consumed: 1,
      node: {
        ...ctx.meta(node, ctx.forced ? 'explicit' : 'rule:definitions'),
        type: 'definitions',
        items,
      },
    }
  },
}
