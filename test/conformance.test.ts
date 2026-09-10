import { describe, expect, it } from 'vitest'
import { find, ir, kitchenSink, walk } from './helpers'

/**
 * "Supports all markdown elements" is a test-suite claim, not an architecture
 * claim. This file is that claim. Every construct in the kitchen sink has to
 * survive the trip to IR without being dropped or mangled.
 */
describe('kitchen sink conformance', () => {
  const document = ir(kitchenSink())

  it('reads frontmatter without rendering it', () => {
    expect(document.frontmatter.title).toBe('Kitchen Sink')
    expect(document.title).toBe('Kitchen Sink')
    expect(walk(document).some((block) => block.type === 'html' && /Kitchen Sink/.test(block.value)))
      .toBe(false)
  })

  it('produces every block kind the fixture exercises', () => {
    const kinds = new Set(walk(document).map((block) => block.type))
    for (const expected of [
      'section', 'heading', 'paragraph', 'list', 'listItem', 'code', 'table',
      'blockquote', 'thematicBreak', 'html', 'math', 'mermaid', 'imageBlock',
      'cards', 'stepper', 'callout', 'chart', 'comparison', 'definitions', 'tree',
    ]) {
      expect(kinds, `missing block kind: ${expected}`).toContain(expected)
    }
  })

  it('captures footnote definitions with block content', () => {
    expect(document.footnotes).toHaveLength(1)
    const [footnote] = document.footnotes
    expect(footnote?.identifier).toBe('1')
    expect(footnote?.children.length).toBeGreaterThan(1)
  })

  it('gives every heading a unique slug', () => {
    const slugs = document.toc.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('parses code fence metadata', () => {
    const fence = find(document, 'code').find((block) => block.lang === 'ts')
    expect(fence?.title).toBe('pipeline.ts')
    expect(fence?.highlightLines).toEqual([2, 3])
  })

  it('renders a ragged table as a rectangle', () => {
    const ragged = find(document, 'table').find((table) => table.header.length === 3
      && table.rows.some((row) => row.length === 3))
    expect(ragged).toBeDefined()
    for (const row of ragged?.rows ?? []) expect(row).toHaveLength(3)
  })

  it('resolves reference links and images', () => {
    const links = walk(document).flatMap((block) =>
      'children' in block && Array.isArray(block.children)
        ? block.children.filter((child) => (child as { type?: string }).type === 'link')
        : [],
    ) as { url: string }[]
    expect(links.some((link) => link.url === 'https://example.com/collapsed')).toBe(true)
  })

  it('keeps unresolved references as literal text', () => {
    const text = JSON.stringify(document)
    expect(text).toContain('[undefined reference]')
  })

  it('records no errors for a well-formed document', () => {
    expect(document.diagnostics.filter((entry) => entry.level === 'warn')).toEqual([])
  })
})

describe('security', () => {
  const document = ir(kitchenSink())
  const serialized = JSON.stringify(document)

  it('strips script tags and their contents', () => {
    expect(serialized).not.toContain('alert(')
    expect(serialized).not.toContain('<script')
  })

  it('neutralises javascript: urls', () => {
    expect(serialized).not.toContain('javascript:')
  })

  it('adds rel=noopener to target=_blank links', () => {
    // The fixture's target=_blank link is inline HTML inside a paragraph, not
    // a block-level html node, so look at the serialized document.
    expect(serialized).toContain('rel=\\"noopener noreferrer\\"')
  })
})
