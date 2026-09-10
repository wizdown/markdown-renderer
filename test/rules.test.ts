import { describe, expect, it } from 'vitest'
import { find, first, ir } from './helpers'

/**
 * Each rule gets two kinds of test: the shape it must promote, and the shapes
 * it must leave alone. The refusals matter more — a heuristic that fires too
 * eagerly is worse than no heuristic, because a wrong rendering is harder to
 * see through than a plain one.
 */

describe('cards', () => {
  it('promotes a short flat list', () => {
    const cards = first(ir('- Alpha\n- Beta\n- Gamma\n'), 'cards')
    expect(cards.items).toHaveLength(3)
    expect(cards.columns).toBe(3)
    expect(cards.origin).toBe('rule:cards')
  })

  it('refuses long items', () => {
    const long = 'x'.repeat(100)
    expect(find(ir(`- ${long}\n- ${long}\n- ${long}\n`), 'cards')).toHaveLength(0)
  })

  it('refuses lists that are too short or too long', () => {
    expect(find(ir('- a\n- b\n'), 'cards')).toHaveLength(0)
    expect(find(ir('- a\n- b\n- c\n- d\n- e\n- f\n- g\n'), 'cards')).toHaveLength(0)
  })

  it('refuses ordered lists, task lists and nested lists', () => {
    expect(find(ir('1. a\n2. b\n3. c\n'), 'cards')).toHaveLength(0)
    expect(find(ir('- [ ] a\n- [x] b\n- [ ] c\n'), 'cards')).toHaveLength(0)
    expect(find(ir('- a\n  - a1\n- b\n- c\n'), 'cards')).toHaveLength(0)
  })

  it('picks even columns for four items', () => {
    expect(first(ir('- a\n- b\n- c\n- d\n'), 'cards').columns).toBe(2)
  })
})

describe('definitions', () => {
  it('wins over cards for term/description pairs', () => {
    const document = ir('- **One** — first\n- **Two** — second\n- **Three** — third\n')
    expect(find(document, 'cards')).toHaveLength(0)
    expect(first(document, 'definitions').items).toHaveLength(3)
  })

  it('handles plain-text terms with a colon', () => {
    const definitions = first(ir('- Alpha: the first one\n- Beta: the second one\n'), 'definitions')
    expect(definitions.items).toHaveLength(2)
  })

  it('refuses when only some items are pairs', () => {
    expect(find(ir('- **One** — first\n- just a bullet\n'), 'definitions')).toHaveLength(0)
  })

  it('refuses sentences that merely contain a colon', () => {
    const source = '- Here is a much longer sentence that happens to include: a colon\n'
      + '- And here is another sentence that also happens to include: a colon\n'
    expect(find(ir(source), 'definitions')).toHaveLength(0)
  })
})

describe('stepper', () => {
  it('promotes an ordered list', () => {
    const stepper = first(ir('1. First\n2. Second\n3. Third\n'), 'stepper')
    expect(stepper.items).toHaveLength(3)
    expect(stepper.start).toBe(1)
  })

  it('preserves a custom start', () => {
    expect(first(ir('5. Five\n6. Six\n7. Seven\n'), 'stepper').start).toBe(5)
  })

  it('refuses two-item lists', () => {
    expect(find(ir('1. a\n2. b\n'), 'stepper')).toHaveLength(0)
  })

  it('refuses items that do not open with prose', () => {
    expect(find(ir('1. a\n2. b\n3.\n   ```\n   code\n   ```\n'), 'stepper')).toHaveLength(0)
  })
})

describe('callout', () => {
  it('reads GitHub alert syntax', () => {
    const callout = first(ir('> [!WARNING]\n> Mind the gap.\n'), 'callout')
    expect(callout.kind).toBe('warning')
    expect(JSON.stringify(callout.children)).toContain('Mind the gap.')
    expect(JSON.stringify(callout.children)).not.toContain('[!WARNING]')
  })

  it('reads the bold-label style and strips the label', () => {
    const callout = first(ir('> **Tip:** be brief.\n'), 'callout')
    expect(callout.kind).toBe('tip')
    expect(JSON.stringify(callout.children)).toContain('be brief.')
    expect(JSON.stringify(callout.children)).not.toContain('Tip')
  })

  it('leaves an ordinary quotation alone', () => {
    const document = ir('> The past is never dead.\n')
    expect(find(document, 'callout')).toHaveLength(0)
    expect(find(document, 'blockquote')).toHaveLength(1)
  })
})

describe('chart', () => {
  const revenue = '| Quarter | Revenue |\n| --- | ---: |\n| Q1 | 10 |\n| Q2 | 20 |\n| Q3 | 30 |\n'

  it('promotes a numeric table and keeps the table underneath', () => {
    const chart = first(ir(revenue), 'chart')
    expect(chart.series).toHaveLength(1)
    expect(chart.series[0]?.values).toEqual([10, 20, 30])
    expect(chart.categories).toEqual(['Q1', 'Q2', 'Q3'])
    expect(chart.table.rows).toHaveLength(3)
  })

  it('uses a line for sequential categories', () => {
    const years = '| Year | Value |\n| --- | ---: |\n| 2021 | 1 |\n| 2022 | 2 |\n| 2023 | 3 |\n'
    expect(first(ir(years), 'chart').variant).toBe('line')
  })

  it('groups multiple numeric columns over non-sequential categories', () => {
    const source = '| Team | A | B |\n| --- | ---: | ---: |\n| Core | 1 | 2 |\n'
      + '| Growth | 3 | 4 |\n| Platform | 5 | 6 |\n'
    const chart = first(ir(source), 'chart')
    expect(chart.variant).toBe('groupedBar')
    expect(chart.series.map((series) => series.name)).toEqual(['A', 'B'])
  })

  it('prefers a line over grouped bars when the categories are a sequence', () => {
    const source = '| Q | A | B |\n| --- | ---: | ---: |\n| Q1 | 1 | 2 |\n| Q2 | 3 | 4 |\n| Q3 | 5 | 6 |\n'
    expect(first(ir(source), 'chart').variant).toBe('line')
  })

  it('carries a shared unit', () => {
    const source = '| Q | Share |\n| --- | ---: |\n| Q1 | 10% |\n| Q2 | 20% |\n| Q3 | 30% |\n'
    expect(first(ir(source), 'chart').unit.suffix).toBe('%')
  })

  it('refuses columns with mixed units', () => {
    const source = '| Q | Mixed |\n| --- | ---: |\n| Q1 | 10% |\n| Q2 | 3.2s |\n| Q3 | 30% |\n'
    expect(find(ir(source), 'chart')).toHaveLength(0)
  })

  it('refuses tables with no numeric column', () => {
    const source = '| Name | Role |\n| --- | --- |\n| Ada | Maths |\n| Alan | Logic |\n'
    expect(find(ir(source), 'chart')).toHaveLength(0)
    expect(find(ir(source), 'table')).toHaveLength(1)
  })

  it('treats blank cells as gaps, not as text', () => {
    const source = '| Q | V |\n| --- | ---: |\n| Q1 | 1 |\n| Q2 | — |\n| Q3 | 3 |\n'
    expect(first(ir(source), 'chart').series[0]?.values).toEqual([1, null, 3])
  })
})

describe('comparison', () => {
  const source = [
    '## Trade-offs', '',
    '### Pros', '', '- Fast', '- Cheap', '- Simple', '',
    '### Cons', '', '- Rigid', '- Manual', '- Limited', '',
  ].join('\n')

  it('pairs two parallel sub-sections into columns', () => {
    const comparison = first(ir(source), 'comparison')
    expect(comparison.columns).toHaveLength(2)
    expect(JSON.stringify(comparison.columns[0]?.title)).toContain('Pros')
  })

  it('refuses top-level sections, which are the document spine', () => {
    const topLevel = '## Pros\n\n- Fast\n- Cheap\n\n## Cons\n\n- Rigid\n- Manual\n'
    expect(find(ir(topLevel), 'comparison')).toHaveLength(0)
  })

  it('refuses sections of wildly different size', () => {
    const lopsided = '## T\n\n### A\n\n- one\n\n### B\n\n- 1\n- 2\n- 3\n- 4\n- 5\n- 6\n'
    expect(find(ir(lopsided), 'comparison')).toHaveLength(0)
  })

  it('refuses a run of four parallel sections', () => {
    const many = '## T\n\n' + ['A', 'B', 'C', 'D']
      .map((name) => `### ${name}\n\n- one\n- two\n`)
      .join('\n')
    expect(find(ir(many), 'comparison')).toHaveLength(0)
  })

  it('refuses sections whose bodies are not both lists', () => {
    const prose = '## T\n\n### A\n\nA paragraph, not a list.\n\n### B\n\n- one\n- two\n'
    expect(find(ir(prose), 'comparison')).toHaveLength(0)
  })

  it('refuses a list beside a numbered procedure', () => {
    const mixed = '## T\n\n### A\n\n- one\n- two\n\n### B\n\n1. first\n2. second\n'
    expect(find(ir(mixed), 'comparison')).toHaveLength(0)
  })

  it('refuses when a list is accompanied by prose', () => {
    const withProse = '## T\n\n### A\n\nIntro line.\n\n- one\n- two\n\n### B\n\n- three\n- four\n'
    expect(find(ir(withProse), 'comparison')).toHaveLength(0)
  })

  it('still honours an explicit request at any depth', () => {
    const forced = '<!-- render: comparison -->\n## Pros\n\n- Fast\n\n## Cons\n\n- Rigid\n'
    expect(find(ir(forced), 'comparison')).toHaveLength(1)
  })
})

describe('tree', () => {
  it('promotes a three-level list', () => {
    const tree = first(ir('- a\n  - b\n    - c\n'), 'tree')
    expect(tree.collapseBelow).toBe(2)
    expect(tree.list.type).toBe('list')
  })

  it('refuses a two-level list', () => {
    expect(find(ir('- a\n  - b\n'), 'tree')).toHaveLength(0)
  })

  it('refuses task lists, whose value is seeing every box at once', () => {
    expect(find(ir('- [ ] a\n  - [ ] b\n    - [ ] c\n'), 'tree')).toHaveLength(0)
  })
})

describe('nesting', () => {
  it('does not promote a comparison column list into cards', () => {
    const source = [
      '## Trade-offs', '',
      '### Pros', '', '- Fast', '- Cheap', '- Simple', '',
      '### Cons', '', '- Rigid', '- Manual', '- Limited', '',
    ].join('\n')
    const document = ir(source)
    expect(find(document, 'comparison')).toHaveLength(1)
    expect(find(document, 'cards')).toHaveLength(0)
    expect(find(document, 'list')).toHaveLength(2)
  })

  it('still renders rich content inside a promoted block', () => {
    const source = '- item one\n- item two\n- third item with code:\n\n  ```ts\n  const x = 1\n  ```\n'
    const document = ir(source)
    expect(find(document, 'code')).toHaveLength(1)
  })
})
