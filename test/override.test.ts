import { describe, expect, it } from 'vitest'
import { applyOverride, currentOverride } from '../src/core/override'
import { find, first, ir } from './helpers'

/**
 * The override round-trip is the promise that a wrong guess is cheap: the UI
 * writes one line, the next parse honours it, and deleting that line restores
 * the original behaviour.
 */
describe('applyOverride', () => {
  const source = '# Title\n\n- Alpha\n- Beta\n- Gamma\n'

  it('inserts an annotation above the block', () => {
    const cards = first(ir(source), 'cards')
    const result = applyOverride(source, cards, 'prose')
    expect(result.changed).toBe(true)
    expect(result.source).toBe('# Title\n\n<!-- render: prose -->\n- Alpha\n- Beta\n- Gamma\n')
  })

  it('round-trips: the next parse honours what was written', () => {
    const cards = first(ir(source), 'cards')
    const pinned = applyOverride(source, cards, 'prose').source
    expect(find(ir(pinned), 'cards')).toHaveLength(0)
    expect(find(ir(pinned), 'list')).toHaveLength(1)
  })

  it('replaces an existing annotation instead of stacking them', () => {
    const pinned = applyOverride(source, first(ir(source), 'cards'), 'prose').source
    const list = first(ir(pinned), 'list')
    const changed = applyOverride(pinned, list, 'stepper').source
    expect(changed.match(/render:/g)).toHaveLength(1)
    expect(changed).toContain('render: stepper')
  })

  it('clears an annotation, handing the block back to the rules', () => {
    const pinned = applyOverride(source, first(ir(source), 'cards'), 'prose').source
    const cleared = applyOverride(pinned, first(ir(pinned), 'list'), null).source
    expect(cleared).toBe(source)
    expect(find(ir(cleared), 'cards')).toHaveLength(1)
  })

  it('preserves indentation for a nested block', () => {
    const nested = '- outer\n\n  - a\n  - b\n  - c\n'
    const cards = first(ir(nested), 'cards')
    const result = applyOverride(nested, cards, 'prose')
    expect(result.source).toContain('  <!-- render: prose -->')
  })

  it('is a no-op when nothing would change', () => {
    const pinned = applyOverride(source, first(ir(source), 'cards'), 'prose').source
    expect(applyOverride(pinned, first(ir(pinned), 'list'), 'prose').changed).toBe(false)
  })

  it('reports the annotation currently in force', () => {
    const pinned = applyOverride(source, first(ir(source), 'cards'), 'prose').source
    expect(currentOverride(pinned, first(ir(pinned), 'list'))).toBe('prose')
    expect(currentOverride(source, first(ir(source), 'cards'))).toBeNull()
  })

  it('does not mistake an ordinary comment for an annotation', () => {
    const commented = '# Title\n\n<!-- just a note -->\n- Alpha\n- Beta\n- Gamma\n'
    const cards = first(ir(commented), 'cards')
    const result = applyOverride(commented, cards, 'prose')
    expect(result.source).toContain('<!-- just a note -->')
    expect(result.source.match(/<!--/g)).toHaveLength(2)
  })
})
