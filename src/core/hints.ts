import type { RootContent } from 'mdast'
import { PROMOTABLE, type PromotableKind } from './ir'
import type { MdNode } from './sections'

/**
 * Explicit layout annotations. Two syntaxes, deliberately:
 *
 *   :::cards{columns=2}      a container directive, for authoring
 *   <!-- render: cards -->   a one-line hint, for the override UI
 *
 * The comment form exists because the override UI writes back into the source
 * file. Inserting a single line above a block is trivially reversible — the
 * author deletes one line — where wrapping a block in a fence is a multi-line
 * edit that is easy to get wrong and annoying to undo.
 *
 * `prose` is a first-class value: it pins a block to its plain rendering and
 * is how "this guess was wrong" gets recorded.
 */

export type HintKind = PromotableKind | 'prose'

export interface Hint {
  kind: HintKind
  attributes: Record<string, string>
}

const HINT_RE = /^<!--\s*render:\s*([a-z]+)((?:\s+[a-z-]+=[^\s>]+)*)\s*-->$/i

const VALID = new Set<string>([...PROMOTABLE, 'prose'])

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const [, key, value] of raw.matchAll(/([a-z-]+)=("[^"]*"|'[^']*'|[^\s]+)/gi)) {
    if (key === undefined || value === undefined) continue
    attributes[key.toLowerCase()] = value.replace(/^["']|["']$/g, '')
  }
  return attributes
}

/** Reads `<!-- render: ... -->` out of a raw-HTML node. */
export function readCommentHint(node: MdNode): Hint | null {
  if (node.type !== 'html') return null
  const match = HINT_RE.exec(node.value.trim())
  if (match === null) return null
  const kind = (match[1] ?? '').toLowerCase()
  if (!VALID.has(kind)) return null
  return { kind: kind as HintKind, attributes: parseAttributes(match[2] ?? '') }
}

/** Reads `:::cards{columns=2}` off a container directive node. */
export function readDirectiveHint(node: MdNode): Hint | null {
  if (node.type !== 'containerDirective' && node.type !== 'leafDirective') return null
  const directive = node as unknown as {
    name: string
    attributes?: Record<string, string | null | undefined>
  }
  const kind = directive.name.toLowerCase()
  if (!VALID.has(kind)) return null
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(directive.attributes ?? {})) {
    if (typeof value === 'string') attributes[key] = value
  }
  return { kind: kind as HintKind, attributes }
}

/** True for nodes that exist only to carry a hint and render nothing. */
export function isHintNode(node: MdNode): boolean {
  return readCommentHint(node) !== null
}

/** An HTML comment that is not a hint still renders nothing. */
export function isComment(node: RootContent): boolean {
  return node.type === 'html' && /^<!--[\s\S]*-->$/.test(node.value.trim())
}
