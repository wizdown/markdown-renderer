import type { PhrasingContent, RootContent, List, ListItem, Paragraph } from 'mdast'

/** Flatten inline content to plain text — the input to every length/shape gate. */
export function inlineText(nodes: readonly PhrasingContent[]): string {
  let out = ''
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'inlineCode':
        out += node.value
        break
      case 'math' as string:
      case 'inlineMath' as string:
        out += (node as unknown as { value: string }).value
        break
      case 'image':
        out += node.alt ?? ''
        break
      case 'break':
        out += ' '
        break
      case 'html':
        break
      default: {
        const children = (node as { children?: PhrasingContent[] }).children
        if (children) out += inlineText(children)
      }
    }
  }
  return out
}

export function blockText(nodes: readonly RootContent[]): string {
  return nodes
    .map((node) => {
      if ('value' in node && typeof node.value === 'string') return node.value
      const children = (node as { children?: RootContent[] }).children
      return children ? blockText(children) : ''
    })
    .join(' ')
    .trim()
}

export function isParagraph(node: RootContent | undefined): node is Paragraph {
  return node?.type === 'paragraph'
}

export function isList(node: RootContent | undefined): node is List {
  return node?.type === 'list'
}

/** A list item that is exactly one paragraph — the shape most rules require. */
export function singleParagraphItem(item: ListItem): Paragraph | null {
  const [only] = item.children
  return item.children.length === 1 && isParagraph(only) ? only : null
}

export function listDepth(list: List, current = 1): number {
  let deepest = current
  for (const item of list.children) {
    for (const child of item.children) {
      if (isList(child)) deepest = Math.max(deepest, listDepth(child, current + 1))
    }
  }
  return deepest
}

export function hasTaskItems(list: List): boolean {
  return list.children.some((item) => item.checked !== null && item.checked !== undefined)
}

// ---------------------------------------------------------------------------
// Numbers — used only by the chart rule
// ---------------------------------------------------------------------------

export interface NumericCell {
  value: number
  prefix: string
  suffix: string
}

const NUMERIC_RE = /^([^\d\-+.]*)\s*([-+]?\d[\d,_\s]*(?:\.\d+)?)\s*([^\d]*)$/

/** Empty-ish cells are gaps in a series, not evidence that a column is text. */
export function isBlankCell(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === '' || trimmed === '-' || trimmed === '—' || trimmed === 'n/a' || trimmed === 'N/A'
}

export function parseNumericCell(text: string): NumericCell | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const match = NUMERIC_RE.exec(trimmed)
  if (match === null) return null
  const digits = (match[2] ?? '').replace(/[,_\s]/g, '')
  const value = Number(digits)
  if (!Number.isFinite(value)) return null
  return { value, prefix: (match[1] ?? '').trim(), suffix: (match[3] ?? '').trim() }
}

export interface ColumnAnalysis {
  values: (number | null)[]
  prefix: string
  suffix: string
}

/**
 * A column counts as numeric when every non-blank cell parses as a number and
 * they all carry the same unit. Mixed units ("50%" next to "3.2s") mean the
 * column is not one series and must not be charted on one axis.
 */
export function analyzeNumericColumn(cells: string[]): ColumnAnalysis | null {
  const values: (number | null)[] = []
  const prefixes = new Set<string>()
  const suffixes = new Set<string>()
  let parsed = 0

  for (const cell of cells) {
    if (isBlankCell(cell)) {
      values.push(null)
      continue
    }
    const numeric = parseNumericCell(cell)
    if (numeric === null) return null
    values.push(numeric.value)
    prefixes.add(numeric.prefix)
    suffixes.add(numeric.suffix)
    parsed += 1
  }

  if (parsed < 2 || prefixes.size > 1 || suffixes.size > 1) return null
  return {
    values,
    prefix: [...prefixes][0] ?? '',
    suffix: [...suffixes][0] ?? '',
  }
}

/** Years, quarters and ISO dates read as a sequence, so they get a line chart. */
export function looksSequential(categories: string[]): boolean {
  if (categories.length < 3) return false
  const patterns = [
    /^(19|20)\d{2}$/,
    /^(19|20)\d{2}[-/](0?[1-9]|1[0-2])/,
    /^q[1-4](\s|-|\/)?(19|20)?\d{0,4}$/i,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^(week|day|month|year)\s*\d+$/i,
  ]
  return patterns.some((pattern) => categories.every((category) => pattern.test(category.trim())))
}
