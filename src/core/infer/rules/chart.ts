import type { Table } from 'mdast'
import type { IRChart, IRTable } from '../../ir'
import type { Rule } from '../types'
import { buildTable } from '../../table'
import { analyzeNumericColumn, inlineText, looksSequential, parseNumericCell } from '../helpers'

/**
 * Tables whose columns are actually series become a chart — with the table
 * still available underneath, always, via a toggle. The chart is a *view* of
 * the data, never a replacement for it: a reader who needs the exact numbers
 * must be able to get them, and a screen reader must reach the real table.
 *
 * A column qualifies only if every non-blank cell parses as a number and they
 * share one unit. That rules out "3.2s" beside "50%", which would otherwise
 * land two incompatible scales on one axis.
 */

const MAX_SERIES = 6
const MIN_ROWS = 2
const MAX_ROWS = 40

export const chartRule: Rule = {
  name: 'chart',
  match(nodes, index, ctx) {
    const node = nodes[index]
    if (node?.type !== 'table') return null
    const table = node as Table

    const meta = ctx.meta(node, ctx.forced ? 'explicit' : 'rule:chart')
    const ir: IRTable = buildTable(table, ctx.inline, { ...meta, origin: 'markdown' })

    const [headerRow, ...bodyRows] = table.children
    if (headerRow === undefined) return null
    if (bodyRows.length < MIN_ROWS || bodyRows.length > MAX_ROWS) return null
    if (headerRow.children.length < 2) return null

    const columnText = (columnIndex: number): string[] =>
      bodyRows.map((row) => inlineText(row.children[columnIndex]?.children ?? []))

    const categories = columnText(0).map((text) => text.trim())
    if (categories.some((category) => category === '')) return null

    // The first column is the category axis. Bare numbers there usually mean
    // the table has no label column at all — except when they are a sequence
    // like years, which are labels that happen to be written as numbers.
    const bareNumericCategories = categories.every((category) => {
      const parsed = parseNumericCell(category)
      return parsed !== null && parsed.prefix === '' && parsed.suffix === ''
    })
    if (bareNumericCategories && !looksSequential(categories)) return null

    const series: IRChart['series'] = []
    let suffix = ''
    let prefix = ''

    for (let column = 1; column < headerRow.children.length; column += 1) {
      const analysis = analyzeNumericColumn(columnText(column))
      if (analysis === null) {
        // One stray text column (a "notes" trailing column) is common; it just
        // does not become a series. But if *no* column is numeric, this is a
        // plain table and the rule does not apply.
        continue
      }
      if (series.length > 0 && (analysis.suffix !== suffix || analysis.prefix !== prefix)) continue
      suffix = analysis.suffix
      prefix = analysis.prefix
      series.push({
        name: inlineText(headerRow.children[column]?.children ?? []).trim() || `Series ${column}`,
        values: analysis.values,
      })
    }

    if (series.length === 0 || series.length > MAX_SERIES) {
      if (ctx.forced) ctx.warn('Table has no numeric columns to chart', node)
      return null
    }

    const requested = ctx.attributes.variant
    const variant: IRChart['variant'] =
      requested === 'bar' || requested === 'line' || requested === 'groupedBar'
        ? requested
        : looksSequential(categories)
          ? 'line'
          : series.length > 1
            ? 'groupedBar'
            : 'bar'

    return {
      consumed: 1,
      node: {
        ...meta,
        type: 'chart',
        variant,
        categoryLabel: inlineText(headerRow.children[0]?.children ?? []).trim(),
        categories,
        series,
        unit: { prefix, suffix },
        table: ir,
      },
    }
  },
}
