import type { IRBlock, IRDocument, IRInline, IRSection } from './ir'

/**
 * Deck mode is a *projection* of the IR, not a second parse.
 *
 * The same tree that renders as a document gets partitioned into panels here,
 * which is what makes the two modes agree about content and lets the reader
 * switch without losing their place. Nothing in this file re-reads markdown.
 */

export interface Panel {
  id: string
  /** null for the intro panel when a document opens with prose. */
  title: IRInline[] | null
  slug: string | null
  depth: number
  blocks: IRBlock[]
  /**
   * Reveal keys in render order. A key is a block id, or `${id}:${index}` for
   * the items of a list-like block. The renderer resolves the same keys, so
   * the two cannot drift.
   */
  revealKeys: string[]
}

export interface Deck {
  panels: Panel[]
  splitDepth: number
}

const ITEMISED = new Set(['list', 'cards', 'stepper', 'definitions'])

/** Item counts for the block kinds that reveal one item at a time. */
function itemCount(block: IRBlock): number {
  switch (block.type) {
    case 'list':
      return block.children.length
    case 'cards':
    case 'stepper':
      return block.items.length
    case 'definitions':
      return block.items.length
    default:
      return 0
  }
}

function revealKeysFor(blocks: readonly IRBlock[]): string[] {
  const keys: string[] = []
  for (const block of blocks) {
    if (ITEMISED.has(block.type)) {
      const count = itemCount(block)
      // A one-item list is not a build; revealing it separately just adds a
      // keypress that shows nothing new.
      if (count > 1) {
        for (let index = 0; index < count; index += 1) keys.push(`${block.id}:${index}`)
        continue
      }
    }
    keys.push(block.id)
  }
  return keys
}

function countSectionsAtDepth(blocks: readonly IRBlock[], depth: number): number {
  let total = 0
  const walk = (nodes: readonly IRBlock[]): void => {
    for (const node of nodes) {
      if (node.type !== 'section') continue
      if (node.depth === depth) total += 1
      walk(node.children)
    }
  }
  walk(blocks)
  return total
}

/**
 * Pick the heading level that carves the document into a sensible number of
 * panels. Splitting on H2 is right for most documents, but a file written
 * entirely in H1s would otherwise collapse into a single slide.
 */
export function autoSplitDepth(document: IRDocument): number {
  for (const depth of [2, 1, 3]) {
    if (countSectionsAtDepth(document.children, depth) >= 2) return depth
  }
  return 2
}

function panelFor(section: IRSection, blocks: IRBlock[]): Panel {
  return {
    id: section.id,
    title: section.heading.children,
    slug: section.heading.slug,
    depth: section.depth,
    blocks,
    revealKeys: revealKeysFor(blocks),
  }
}

export function buildDeck(document: IRDocument, splitDepthOverride?: number): Deck {
  const configured = Number(document.frontmatter.splitDepth)
  const splitDepth =
    splitDepthOverride ??
    (Number.isInteger(configured) && configured >= 1 && configured <= 6
      ? configured
      : autoSplitDepth(document))

  const panels: Panel[] = []

  const emit = (section: IRSection): void => {
    const own: IRBlock[] = []
    const nested: IRSection[] = []

    for (const child of section.children) {
      // Sub-sections deeper than the split level stay inline in this panel;
      // only sections at or above it earn a panel of their own.
      if (child.type === 'section' && child.depth <= splitDepth) nested.push(child)
      else own.push(child)
    }

    // A section that exists only to introduce sub-sections still gets a panel:
    // it is the divider that lets an audience follow the structure.
    panels.push(panelFor(section, own))
    for (const child of nested) emit(child)
  }

  const lead: IRBlock[] = []
  for (const block of document.children) {
    if (block.type === 'section') emit(block)
    else lead.push(block)
  }

  if (lead.length > 0) {
    panels.unshift({
      id: 'panel-intro',
      title: null,
      slug: null,
      depth: 0,
      blocks: lead,
      revealKeys: revealKeysFor(lead),
    })
  }

  // A document with no headings at all is still one panel, not zero.
  if (panels.length === 0) {
    panels.push({
      id: 'panel-empty',
      title: null,
      slug: null,
      depth: 0,
      blocks: [],
      revealKeys: [],
    })
  }

  return { panels, splitDepth }
}
