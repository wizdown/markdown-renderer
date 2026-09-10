import type { IRBlock, IRDocument } from '../core/ir'
import { highlight } from '../render/blocks/highlighter'

/**
 * Resolves every code block's highlighted markup before a static render.
 *
 * `react-dom/server` gets one synchronous pass, so anything asynchronous has
 * to have already happened. Shiki runs perfectly well in Node, so the
 * command-line renderer produces exactly the same markup the app does — no
 * second highlighter, no "syntax highlighting only in the browser" caveat.
 */
function walk(blocks: readonly IRBlock[], visit: (block: IRBlock) => void): void {
  for (const block of blocks) {
    visit(block)
    switch (block.type) {
      case 'section':
      case 'blockquote':
      case 'callout':
      case 'listItem':
      case 'footnoteDefinition':
      case 'list':
        walk(block.children as IRBlock[], visit)
        break
      case 'cards':
      case 'stepper':
        for (const item of block.items) walk(item.children, visit)
        break
      case 'comparison':
        for (const column of block.columns) walk(column.children, visit)
        break
      case 'tree':
        walk([block.list], visit)
        break
      default:
        break
    }
  }
}

export function collectBlocks(document: IRDocument): IRBlock[] {
  const found: IRBlock[] = []
  walk(document.children, (block) => found.push(block))
  walk(document.footnotes, (block) => found.push(block))
  return found
}

export function hasDiagrams(document: IRDocument): boolean {
  return collectBlocks(document).some((block) => block.type === 'mermaid')
}

export async function prehighlight(document: IRDocument): Promise<Map<string, string>> {
  const resolved = new Map<string, string>()

  await Promise.all(
    collectBlocks(document).map(async (block) => {
      if (block.type !== 'code' || block.lang === null) return
      const html = await highlight(block.value, block.lang, block.highlightLines)
      if (html !== null) resolved.set(block.id, html)
    }),
  )

  return resolved
}
