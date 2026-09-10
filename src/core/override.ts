import type { IRBlock } from './ir'
import type { HintKind } from './hints'

/**
 * Writing an override back into the markdown source.
 *
 * A wrong guess has to be cheap to correct, and the correction has to be
 * durable — it must survive a reload, a re-render, and being sent to someone
 * else. Storing it anywhere but the document itself would fail all three.
 *
 * The edit is deliberately one line: insert, replace, or delete a
 * `<!-- render: ... -->` comment above the block. Wrapping the block in a
 * `:::fence` would be a multi-line edit that is easy to get wrong and annoying
 * for the author to undo by hand.
 */

const HINT_LINE = /^\s*<!--\s*render:\s*[a-z]+(?:\s+[a-z-]+=[^\s>]+)*\s*-->\s*$/i

export interface OverrideResult {
  source: string
  changed: boolean
}

function hintLineIndex(lines: readonly string[], blockLine: number): number | null {
  // Walk back over blank lines to find an annotation already attached here.
  for (let index = blockLine - 2; index >= 0; index -= 1) {
    const line = lines[index] ?? ''
    if (line.trim() === '') continue
    return HINT_LINE.test(line) ? index : null
  }
  return null
}

function indentOf(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? ''
}

/**
 * Set, change or clear the annotation on a block.
 * Passing `null` removes any annotation, handing the block back to the rules.
 */
export function applyOverride(
  source: string,
  block: Pick<IRBlock, 'source'>,
  kind: HintKind | null,
): OverrideResult {
  const start = block.source?.start.line
  if (start === undefined) return { source, changed: false }

  const lines = source.split('\n')
  const existing = hintLineIndex(lines, start)

  if (kind === null) {
    if (existing === null) return { source, changed: false }
    lines.splice(existing, 1)
    return { source: lines.join('\n'), changed: true }
  }

  const blockLine = lines[start - 1] ?? ''
  const comment = `${indentOf(blockLine)}<!-- render: ${kind} -->`

  if (existing !== null) {
    if (lines[existing] === comment) return { source, changed: false }
    lines[existing] = comment
    return { source: lines.join('\n'), changed: true }
  }

  lines.splice(start - 1, 0, comment)
  return { source: lines.join('\n'), changed: true }
}

/** What the override menu offers for a block, and what is currently chosen. */
export function currentOverride(source: string, block: Pick<IRBlock, 'source'>): string | null {
  const start = block.source?.start.line
  if (start === undefined) return null
  const lines = source.split('\n')
  const existing = hintLineIndex(lines, start)
  if (existing === null) return null
  return /render:\s*([a-z]+)/i.exec(lines[existing] ?? '')?.[1]?.toLowerCase() ?? null
}
