import type { Blockquote, Paragraph, PhrasingContent, RootContent } from 'mdast'
import type { CalloutKind } from '../../ir'
import type { Rule } from '../types'
import { inlineText } from '../helpers'

/**
 * Blockquotes that are really admonitions.
 *
 * Two conventions in the wild, both purely lexical:
 *   > [!WARNING]        GitHub alerts
 *   > **Note:** ...     the bold-label style everyone writes by hand
 *
 * A blockquote with no recognised label stays a blockquote — an actual
 * quotation should not grow a warning icon.
 */

const KINDS: Record<string, CalloutKind> = {
  note: 'note',
  info: 'note',
  tip: 'tip',
  hint: 'tip',
  important: 'important',
  warning: 'warning',
  warn: 'warning',
  caution: 'caution',
  danger: 'caution',
  quote: 'quote',
}

const GITHUB_ALERT_RE = /^\[!([a-z]+)\]\s*$/i
const BOLD_LABEL_RE = /^([a-z]+)\s*:?\s*$/i

function resolve(word: string): CalloutKind | null {
  return KINDS[word.trim().toLowerCase()] ?? null
}

/** `> [!NOTE]` — the label owns the first line, the body is everything after. */
function matchGithubAlert(quote: Blockquote): { kind: CalloutKind; body: RootContent[] } | null {
  const [first] = quote.children
  if (first?.type !== 'paragraph') return null

  const [firstInline, secondInline] = first.children
  if (firstInline?.type !== 'text') return null

  const [line, ...restOfLine] = firstInline.value.split('\n')
  const match = GITHUB_ALERT_RE.exec((line ?? '').trim())
  if (match === null) return null
  const kind = resolve(match[1] ?? '')
  if (kind === null) return null

  const remainder = restOfLine.join('\n').replace(/^\n+/, '')
  const rest: PhrasingContent[] = []
  if (remainder !== '') rest.push({ type: 'text', value: remainder })
  // A hard break directly after the label leaves nothing useful to carry over.
  if (secondInline?.type !== 'break') rest.push(...first.children.slice(1))

  const body: RootContent[] = []
  if (rest.length > 0) body.push({ type: 'paragraph', children: rest } as Paragraph)
  body.push(...quote.children.slice(1))
  return { kind, body }
}

/** `> **Note:** body` — strip the bold label, keep the sentence it introduced. */
function matchBoldLabel(quote: Blockquote): { kind: CalloutKind; body: RootContent[] } | null {
  const [first] = quote.children
  if (first?.type !== 'paragraph') return null

  const [label, ...rest] = first.children
  if (label?.type !== 'strong') return null

  const match = BOLD_LABEL_RE.exec(inlineText(label.children))
  if (match === null) return null
  const kind = resolve(match[1] ?? '')
  if (kind === null) return null

  const trimmed = [...rest]
  const [next] = trimmed
  if (next?.type === 'text') {
    const value = next.value.replace(/^[\s:—-]+/, '')
    if (value === '' && trimmed.length === 1) trimmed.length = 0
    else trimmed[0] = { type: 'text', value }
  }

  const body: RootContent[] = []
  if (trimmed.length > 0) body.push({ type: 'paragraph', children: trimmed } as Paragraph)
  body.push(...quote.children.slice(1))
  return { kind, body }
}

export const calloutRule: Rule = {
  name: 'callout',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'blockquote') return null
    const quote = node as Blockquote

    const detected = matchGithubAlert(quote) ?? matchBoldLabel(quote)
    if (detected === null && !ctx.forced) return null

    const kind =
      (ctx.attributes.kind !== undefined ? resolve(ctx.attributes.kind) : null) ??
      detected?.kind ??
      'note'
    const body = detected?.body ?? quote.children

    return {
      consumed: 1,
      node: {
        ...ctx.meta(node, ctx.forced ? 'explicit' : 'rule:callout'),
        type: 'callout',
        kind,
        title: ctx.attributes.title ?? null,
        children: ctx.blocks(body),
      },
    }
  },
}
