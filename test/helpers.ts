import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToIR } from '../src/core/toIR'
import type { IRBlock, IRDocument } from '../src/core/ir'

export function ir(source: string): IRDocument {
  return renderToIR(source)
}

export function kitchenSink(): string {
  return readFileSync(fileURLToPath(new URL('../fixtures/kitchen-sink.md', import.meta.url)), 'utf8')
}

/** Depth-first walk over every block, descending into every container. */
export function walk(document: IRDocument): IRBlock[] {
  const out: IRBlock[] = []
  const visit = (blocks: readonly IRBlock[]): void => {
    for (const block of blocks) {
      out.push(block)
      switch (block.type) {
        case 'section':
          visit([block.heading])
          visit(block.children)
          break
        case 'blockquote':
        case 'callout':
        case 'listItem':
        case 'footnoteDefinition':
          visit(block.children)
          break
        case 'list':
          visit(block.children)
          break
        case 'cards':
        case 'stepper':
          for (const item of block.items) visit(item.children)
          break
        case 'comparison':
          for (const column of block.columns) visit(column.children)
          break
        case 'tree':
          visit([block.list])
          break
        case 'chart':
          visit([block.table])
          break
        default:
          break
      }
    }
  }
  visit(document.children)
  visit(document.footnotes)
  return out
}

export function find<T extends IRBlock['type']>(
  document: IRDocument,
  type: T,
): Extract<IRBlock, { type: T }>[] {
  return walk(document).filter((block): block is Extract<IRBlock, { type: T }> => block.type === type)
}

export function first<T extends IRBlock['type']>(
  document: IRDocument,
  type: T,
): Extract<IRBlock, { type: T }> {
  const [match] = find(document, type)
  if (match === undefined) throw new Error(`No ${type} block found`)
  return match
}
