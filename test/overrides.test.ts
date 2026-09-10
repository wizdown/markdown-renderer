import { describe, expect, it } from 'vitest'
import { buildDeck } from '../src/core/deck'
import { find, first, ir } from './helpers'

describe('explicit annotations', () => {
  it('pins a block to prose with a comment hint', () => {
    const document = ir('<!-- render: prose -->\n- Alpha\n- Beta\n- Gamma\n')
    expect(find(document, 'cards')).toHaveLength(0)
    expect(find(document, 'list')).toHaveLength(1)
  })

  it('forces a promotion the heuristics would refuse', () => {
    // Two items is below the card rule's own minimum.
    const cards = first(ir('<!-- render: cards -->\n- Alpha\n- Beta\n'), 'cards')
    expect(cards.items).toHaveLength(2)
    expect(cards.origin).toBe('explicit')
  })

  it('reads attributes from a comment hint', () => {
    const source = '<!-- render: chart variant=line -->\n'
      + '| Team | V |\n| --- | ---: |\n| Core | 1 |\n| Growth | 2 |\n| Platform | 3 |\n'
    expect(first(ir(source), 'chart').variant).toBe('line')
  })

  it('reads a container directive and its attributes', () => {
    const cards = first(ir(':::cards{columns=2}\n- Alpha\n- Beta\n- Gamma\n:::\n'), 'cards')
    expect(cards.columns).toBe(2)
    expect(cards.origin).toBe('explicit')
  })

  it('never renders the hint comment itself', () => {
    const document = ir('<!-- render: cards -->\n- Alpha\n- Beta\n')
    expect(JSON.stringify(document)).not.toContain('render:')
  })

  it('falls back to prose and warns when a forced promotion cannot apply', () => {
    const source = '<!-- render: chart -->\n| Name | Role |\n| --- | --- |\n| Ada | Maths |\n| Alan | Logic |\n'
    const document = ir(source)
    expect(find(document, 'chart')).toHaveLength(0)
    expect(find(document, 'table')).toHaveLength(1)
    expect(document.diagnostics.some((entry) => entry.level === 'warn')).toBe(true)
  })

  it('warns about an unknown directive but still renders its content', () => {
    const document = ir(':::mystery\nSome text.\n:::\n')
    expect(JSON.stringify(document)).toContain('Some text.')
    expect(document.diagnostics.some((entry) => /Unknown directive/.test(entry.message))).toBe(true)
  })
})

describe('provenance', () => {
  it('records which rule produced each promotion', () => {
    expect(first(ir('- a\n- b\n- c\n'), 'cards').origin).toBe('rule:cards')
    expect(first(ir('1. a\n2. b\n3. c\n'), 'stepper').origin).toBe('rule:stepper')
    expect(first(ir('> [!NOTE]\n> hi\n'), 'callout').origin).toBe('rule:callout')
  })

  it('keeps source positions so overrides can be written back', () => {
    const cards = first(ir('# Title\n\n- a\n- b\n- c\n'), 'cards')
    expect(cards.source?.start.line).toBe(3)
    expect(cards.source?.end.line).toBe(5)
  })
})

describe('determinism', () => {
  const source = '# Doc\n\n- a\n- b\n- c\n\n| Q | V |\n| --- | ---: |\n| Q1 | 1 |\n| Q2 | 2 |\n| Q3 | 3 |\n'

  it('produces an identical tree on every run', () => {
    expect(JSON.stringify(ir(source))).toBe(JSON.stringify(ir(source)))
  })

  it('produces an identical deck on every run', () => {
    expect(JSON.stringify(buildDeck(ir(source)))).toBe(JSON.stringify(buildDeck(ir(source))))
  })
})
