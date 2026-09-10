import type { Table, PhrasingContent } from 'mdast'
import type { IRInline, IRMeta, IRTable, IRTableCell } from './ir'

export type InlineConverter = (nodes: readonly PhrasingContent[]) => IRInline[]

/**
 * mdast tables are ragged: rows may be shorter or longer than the header, and
 * GFM tolerates both. Every consumer downstream (and the chart rule in
 * particular) assumes a rectangle, so pad and trim to the header width here.
 */
export function buildTable(node: Table, inline: InlineConverter, meta: IRMeta): IRTable {
  const [headerRow, ...bodyRows] = node.children
  const header: IRTableCell[] = (headerRow?.children ?? []).map((cell) => ({
    children: inline(cell.children),
  }))
  const width = header.length

  const rows = bodyRows.map((row) => {
    const cells: IRTableCell[] = row.children
      .slice(0, width)
      .map((cell) => ({ children: inline(cell.children) }))
    while (cells.length < width) cells.push({ children: [] })
    return cells
  })

  return {
    ...meta,
    type: 'table',
    align: (node.align ?? []).slice(0, width).map((value) => value ?? null),
    header,
    rows,
  }
}
