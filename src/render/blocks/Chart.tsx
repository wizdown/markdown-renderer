import { useId, useMemo, useState } from 'react'
import type { IRChart } from '../../core/ir'
import { TableBlock } from './Table'
import { formatValue, niceTicks } from './format'

/**
 * Charts are drawn by hand in SVG rather than pulled from a library: it keeps
 * the bundle small, keeps the static export self-contained, and lets every
 * colour resolve through the same theme tokens as the rest of the page, so
 * light/dark works without a second palette.
 *
 * Colour rules that must not be "tidied up" later:
 *   - Series colours come from --series-1..6 in fixed slot order and are never
 *     cycled. Six is the cap the chart rule enforces; a seventh series would
 *     have to reuse a hue and stop being identifiable.
 *   - Text never wears a series colour. Identity comes from the swatch beside
 *     the label, because several of these hues are illegible as text.
 *   - The table view is always reachable. Three light-mode hues sit below 3:1
 *     against the surface, and the readable-alternative is what makes that
 *     acceptable — it is not optional chrome.
 */

const WIDTH = 760
const SURFACE_GAP = 2
const MAX_BAR = 24

interface Hover {
  x: number
  y: number
  category: string
  entries: { name: string; value: number | null; color: string }[]
}

function seriesColor(index: number): string {
  return `var(--series-${(index % 6) + 1})`
}

function extent(chart: IRChart): { min: number; max: number } {
  const values = chart.series.flatMap((series) =>
    series.values.filter((value): value is number => value !== null),
  )
  if (values.length === 0) return { min: 0, max: 1 }
  return { min: Math.min(0, ...values), max: Math.max(0, ...values) }
}

function Legend({ chart }: { chart: IRChart }) {
  // One series needs no legend — the caption already names what is plotted.
  if (chart.series.length < 2) return null
  return (
    <ul className="chart-legend">
      {chart.series.map((series, index) => (
        <li key={series.name}>
          <span className="chart-swatch" style={{ background: seriesColor(index) }} aria-hidden />
          {series.name}
        </li>
      ))}
    </ul>
  )
}

function Tooltip({ hover, unit }: { hover: Hover; unit: IRChart['unit'] }) {
  return (
    <div className="chart-tooltip" style={{ left: `${hover.x}%`, top: `${hover.y}%` }} role="presentation">
      <div className="chart-tooltip-title">{hover.category}</div>
      {hover.entries.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row">
          <span className="chart-swatch" style={{ background: entry.color }} aria-hidden />
          <span className="chart-tooltip-name">{entry.name}</span>
          <span className="chart-tooltip-value">
            {entry.value === null ? '—' : formatValue(entry.value, unit.prefix, unit.suffix)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Horizontal bars: category labels read left-to-right, so nothing is rotated. */
function Bars({
  chart,
  onHover,
}: {
  chart: IRChart
  onHover: (hover: Hover | null) => void
}) {
  const grouped = chart.series.length > 1
  const { max } = extent(chart)
  const gutter = 132
  const rightGutter = 68
  const plotWidth = WIDTH - gutter - rightGutter

  const band = grouped ? Math.max(28, chart.series.length * 16 + 16) : 34
  const height = chart.categories.length * band + 34
  const barThickness = grouped
    ? Math.min(MAX_BAR, (band - 12) / chart.series.length - SURFACE_GAP)
    : Math.min(MAX_BAR, band - 12)

  const scale = (value: number): number => (max === 0 ? 0 : (value / max) * plotWidth)
  const ticks = niceTicks(0, max, 4)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="chart-svg"
      role="img"
      aria-label={`${chart.variant} chart of ${chart.categoryLabel}`}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={gutter + scale(tick)}
            x2={gutter + scale(tick)}
            y1={8}
            y2={height - 26}
            className="chart-grid"
          />
          <text x={gutter + scale(tick)} y={height - 10} className="chart-tick" textAnchor="middle">
            {formatValue(tick, chart.unit.prefix, chart.unit.suffix)}
          </text>
        </g>
      ))}

      {chart.categories.map((category, rowIndex) => {
        const top = 12 + rowIndex * band
        return (
          <g key={category}>
            <text x={gutter - 12} y={top + band / 2} className="chart-label" textAnchor="end">
              {category}
            </text>
            {chart.series.map((series, seriesIndex) => {
              const value = series.values[rowIndex] ?? null
              if (value === null) return null
              const length = Math.max(0, scale(value))
              const offset = grouped
                ? 6 + seriesIndex * (barThickness + SURFACE_GAP)
                : (band - barThickness) / 2
              const y = top + offset
              const showValue = !grouped || chart.series.length <= 2
              return (
                <g
                  key={series.name}
                  onMouseEnter={() =>
                    onHover({
                      x: ((gutter + length) / WIDTH) * 100,
                      y: ((y + barThickness / 2) / height) * 100,
                      category,
                      entries: chart.series.map((other, index) => ({
                        name: other.name,
                        value: other.values[rowIndex] ?? null,
                        color: seriesColor(index),
                      })),
                    })
                  }
                  onMouseLeave={() => onHover(null)}
                >
                  {/* A rounded data-end with a square baseline: rx on a rect
                      would round the zero end too and detach it from the axis. */}
                  <path
                    d={barPath(gutter, y, length, barThickness)}
                    fill={seriesColor(seriesIndex)}
                  />
                  {showValue && (
                    <text
                      x={gutter + length + 8}
                      y={y + barThickness / 2}
                      className="chart-value"
                    >
                      {formatValue(value, chart.unit.prefix, chart.unit.suffix)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
      <line x1={gutter} x2={gutter} y1={8} y2={height - 26} className="chart-axis" />
    </svg>
  )
}

/** Square at the baseline, 4px rounded at the data end. */
function barPath(x: number, y: number, length: number, thickness: number): string {
  const radius = Math.min(4, length, thickness / 2)
  if (length <= 0.5) return `M${x} ${y} h1 v${thickness} h-1 Z`
  const end = x + length
  return [
    `M${x} ${y}`,
    `H${end - radius}`,
    `Q${end} ${y} ${end} ${y + radius}`,
    `V${y + thickness - radius}`,
    `Q${end} ${y + thickness} ${end - radius} ${y + thickness}`,
    `H${x}`,
    'Z',
  ].join(' ')
}

function Lines({
  chart,
  onHover,
}: {
  chart: IRChart
  onHover: (hover: Hover | null) => void
}) {
  const height = 330
  const left = 62
  const right = 96
  const top = 16
  const bottom = 44
  const plotWidth = WIDTH - left - right
  const plotHeight = height - top - bottom

  const { min, max } = extent(chart)
  const ticks = niceTicks(min, max, 4)
  const lowest = Math.min(...ticks)
  const highest = Math.max(...ticks)
  const span = highest - lowest || 1

  const xAt = (index: number): number =>
    chart.categories.length === 1
      ? left + plotWidth / 2
      : left + (index / (chart.categories.length - 1)) * plotWidth
  const yAt = (value: number): number => top + plotHeight - ((value - lowest) / span) * plotHeight

  // Every fourth label at most, so the axis never becomes a wall of text.
  const labelEvery = Math.ceil(chart.categories.length / 8)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="chart-svg" role="img"
      aria-label={`Line chart of ${chart.categoryLabel}`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={left + plotWidth} y1={yAt(tick)} y2={yAt(tick)} className="chart-grid" />
          <text x={left - 12} y={yAt(tick)} className="chart-tick" textAnchor="end">
            {formatValue(tick, chart.unit.prefix, chart.unit.suffix)}
          </text>
        </g>
      ))}

      {chart.categories.map((category, index) =>
        index % labelEvery === 0 ? (
          <text key={category} x={xAt(index)} y={height - 18} className="chart-tick" textAnchor="middle">
            {category}
          </text>
        ) : null,
      )}

      {chart.series.map((series, seriesIndex) => {
        const points = series.values
          .map((value, index) => (value === null ? null : { x: xAt(index), y: yAt(value) }))
          .filter((point): point is { x: number; y: number } => point !== null)
        if (points.length === 0) return null

        const path = points
          .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
          .join(' ')
        const last = points[points.length - 1]

        return (
          <g key={series.name}>
            <path d={path} className="chart-line" stroke={seriesColor(seriesIndex)} />
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={4}
                fill={seriesColor(seriesIndex)}
                className="chart-dot"
              />
            ))}
            {last !== undefined && chart.series.length <= 4 && (
              <text x={last.x + 10} y={last.y} className="chart-value">
                {series.name}
              </text>
            )}
          </g>
        )
      })}

      {/* One hit band per category: bigger than the dots, and it makes the
          tooltip a crosshair over every series at once rather than per-point. */}
      {chart.categories.map((category, index) => {
        const bandWidth = plotWidth / Math.max(1, chart.categories.length - 1)
        return (
          <rect
            key={category}
            x={xAt(index) - bandWidth / 2}
            y={top}
            width={bandWidth}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() =>
              onHover({
                x: (xAt(index) / WIDTH) * 100,
                y: (top / height) * 100,
                category,
                entries: chart.series.map((series, seriesIndex) => ({
                  name: series.name,
                  value: series.values[index] ?? null,
                  color: seriesColor(seriesIndex),
                })),
              })
            }
            onMouseLeave={() => onHover(null)}
          />
        )
      })}

      <line x1={left} x2={left} y1={top} y2={top + plotHeight} className="chart-axis" />
    </svg>
  )
}

export function ChartBlock({ block }: { block: IRChart }) {
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)
  const tableId = useId()

  const caption = useMemo(
    () =>
      block.series.length === 1
        ? `${block.series[0]?.name ?? ''} by ${block.categoryLabel}`
        : `${block.series.map((series) => series.name).join(', ')} by ${block.categoryLabel}`,
    [block],
  )

  return (
    <figure className="chart-figure">
      <div className="chart-header">
        <figcaption className="chart-caption">{caption}</figcaption>
        <button
          type="button"
          className="chart-toggle"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {/* Both views are always in the DOM, toggled with `hidden` rather than
          conditionally rendered: the static export has no React to re-render
          it, so its script can only show and hide what is already there. */}
      <div className="chart-plot" hidden={showTable} onMouseLeave={() => setHover(null)}>
        {block.variant === 'line' ? (
          <Lines chart={block} onHover={setHover} />
        ) : (
          <Bars chart={block} onHover={setHover} />
        )}
        {hover !== null && !showTable && <Tooltip hover={hover} unit={block.unit} />}
      </div>

      <div className="chart-table-view" id={tableId} hidden={!showTable}>
        <TableBlock block={block.table} />
      </div>

      <Legend chart={block} />
    </figure>
  )
}
