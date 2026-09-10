import { describe, expect, it } from 'vitest'
import { autoSplitDepth, buildDeck } from '../src/core/deck'
import { ir, kitchenSink } from './helpers'

describe('deck projection', () => {
  const source = [
    '# Title', '', 'Some opening prose.', '',
    '## One', '', 'First section.', '',
    '### Detail', '', 'Nested under one.', '',
    '## Two', '', 'Second section.', '',
  ].join('\n')

  it('gives every section at the split depth its own panel', () => {
    const deck = buildDeck(ir(source), 2)
    expect(deck.panels.map((panel) => panel.slug)).toEqual(['title', 'one', 'two'])
  })

  it('keeps sub-sections below the split depth inline', () => {
    const [, one] = buildDeck(ir(source), 2).panels
    expect(one?.blocks.some((block) => block.type === 'section')).toBe(true)
  })

  it('splits deeper when asked', () => {
    const deck = buildDeck(ir(source), 3)
    expect(deck.panels.map((panel) => panel.slug)).toEqual(['title', 'one', 'detail', 'two'])
  })

  it('keeps content that precedes the first heading in an intro panel', () => {
    const deck = buildDeck(ir('Just prose.\n\n## A\n\ntext\n\n## B\n\ntext\n'))
    expect(deck.panels[0]?.title).toBeNull()
    expect(deck.panels[0]?.blocks).toHaveLength(1)
  })

  it('always produces at least one panel', () => {
    expect(buildDeck(ir('')).panels).toHaveLength(1)
    expect(buildDeck(ir('Only a sentence.')).panels).toHaveLength(1)
  })

  it('reads splitDepth from frontmatter', () => {
    expect(buildDeck(ir(kitchenSink())).splitDepth).toBe(2)
  })

  it('falls back to H1 when a document has no H2s', () => {
    expect(autoSplitDepth(ir('# A\n\ntext\n\n# B\n\ntext\n'))).toBe(1)
  })
})

describe('reveal steps', () => {
  it('gives each item of a list-like block its own step', () => {
    const [panel] = buildDeck(ir('## S\n\n- a\n- b\n- c\n')).panels
    expect(panel?.revealKeys).toHaveLength(3)
    expect(panel?.revealKeys.every((key) => key.includes(':'))).toBe(true)
  })

  it('does not split a single-item list into its own step', () => {
    const [panel] = buildDeck(ir('## S\n\n- only\n')).panels
    expect(panel?.revealKeys).toHaveLength(1)
    expect(panel?.revealKeys[0]).not.toContain(':')
  })

  it('gives ordinary blocks one step each', () => {
    const [panel] = buildDeck(ir('## S\n\nOne.\n\nTwo.\n\n```\ncode\n```\n')).panels
    expect(panel?.revealKeys).toHaveLength(3)
  })

  it('keys are unique within a panel', () => {
    for (const panel of buildDeck(ir(kitchenSink())).panels) {
      expect(new Set(panel.revealKeys).size).toBe(panel.revealKeys.length)
    }
  })
})

describe('reveal keys stay top-level', () => {
  /**
   * The exported file walks `[data-reveal]` in the DOM to find its steps, so
   * the projection and the markup have to agree on exactly which nodes are
   * steps. Nested content carries keys but must never become a step, or a
   * panel arrives with every element dimmed.
   */
  it('does not step through lists nested inside a comparison', () => {
    const source = [
      '## Trade-offs', '',
      '### Pros', '', '- Fast', '- Cheap', '- Simple', '',
      '### Cons', '', '- Rigid', '- Manual', '- Limited', '',
    ].join('\n')
    const [panel] = buildDeck(ir(source)).panels
    expect(panel?.revealKeys).toHaveLength(1)
  })

  it('does not step through blocks nested inside a callout', () => {
    const [panel] = buildDeck(ir('## S\n\n> [!NOTE]\n> One.\n>\n> Two.\n')).panels
    expect(panel?.revealKeys).toHaveLength(1)
  })

  it('steps through the items of a top-level list only', () => {
    const [panel] = buildDeck(ir('## S\n\n- a\n  - a1\n  - a2\n- b\n')).panels
    expect(panel?.revealKeys).toHaveLength(2)
  })
})
