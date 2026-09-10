/** Number formatting shared by the chart's axes, labels and tooltips. */

export function formatValue(value: number, prefix = '', suffix = ''): string {
  const magnitude = Math.abs(value)
  let body: string

  if (magnitude >= 1_000_000_000) body = `${trim(value / 1_000_000_000)}B`
  else if (magnitude >= 1_000_000) body = `${trim(value / 1_000_000)}M`
  else if (magnitude >= 10_000) body = `${trim(value / 1_000)}K`
  else body = trim(value)

  return `${prefix}${body}${suffix}`
}

function trim(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('en-US')
    : rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Axis ticks land on 1/2/5 × 10ⁿ so they read as round numbers rather than as
 * whatever the data happened to divide into.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0]
  if (min === max) return [min]

  const rawStep = (max - min) / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude

  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step

  const ticks: number[] = []
  for (let value = start; value <= end + step / 2 && ticks.length < 20; value += step) {
    // Floating-point accumulation leaves 0.30000000000000004 on the axis.
    ticks.push(Math.round(value / step) * step)
  }
  return ticks
}
