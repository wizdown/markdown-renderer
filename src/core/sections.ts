import type { RootContent, Heading } from 'mdast'

/**
 * Headings in mdast are flat siblings: the content "under" a heading is just
 * whatever follows it. Every consumer we have — the TOC, the deck projection,
 * the comparison rule — needs the nesting instead, so we build it once here
 * rather than re-deriving it three times.
 */
export interface MdSection {
  type: 'mdSection'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  heading: Heading
  children: MdNode[]
}

export type MdNode = RootContent | MdSection

export function isSection(node: MdNode): node is MdSection {
  return node.type === 'mdSection'
}

/** Nodes that carry no rendered content and only confuse the rules. */
function isStructural(node: RootContent): boolean {
  // `toml` comes from remark-frontmatter and is not in @types/mdast's union.
  const type: string = node.type
  return type === 'yaml' || type === 'toml' || type === 'definition'
}

export function buildSections(nodes: readonly RootContent[]): MdNode[] {
  const root: MdNode[] = []
  const stack: MdSection[] = []

  const currentChildren = (): MdNode[] => stack[stack.length - 1]?.children ?? root

  for (const node of nodes) {
    if (isStructural(node)) continue

    // Footnote definitions are hoisted to the end of the document by the
    // converter, so they must not get trapped inside whichever section they
    // happened to be written under.
    if (node.type === 'footnoteDefinition') {
      root.push(node)
      continue
    }

    if (node.type === 'heading') {
      const depth = node.depth as MdSection['depth']
      // Close every section at or below this heading's depth before opening.
      while (stack.length > 0 && (stack[stack.length - 1] as MdSection).depth >= depth) {
        stack.pop()
      }
      const section: MdSection = { type: 'mdSection', depth, heading: node, children: [] }
      currentChildren().push(section)
      stack.push(section)
      continue
    }

    currentChildren().push(node)
  }

  return root
}
