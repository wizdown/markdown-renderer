import { describe, expect, it } from 'vitest'
import { parseArgs } from '../src/cli'
import { renderStaticDocument } from '../src/export/renderStatic'
import { APP_STYLES } from '../src/export/styles'
import { hasDiagrams } from '../src/export/prehighlight'
import { ir, kitchenSink } from './helpers'

/**
 * These run in Node with no DOM at all, which is the point of the static
 * renderer: the exported file can now be verified in the test suite instead of
 * only by opening a browser.
 */

async function render(source: string, diagramRuntime: string | null = null): Promise<string> {
  return renderStaticDocument(ir(source), { styles: APP_STYLES, diagramRuntime })
}

describe('parseArgs', () => {
  it('reads an input path', () => {
    expect(parseArgs(['doc.md']).input).toBe('doc.md')
  })

  it('reads output, title and flags', () => {
    const options = parseArgs(['doc.md', '-o', 'out.html', '--title', 'Talk', '--diagrams'])
    expect(options).toMatchObject({
      input: 'doc.md',
      out: 'out.html',
      title: 'Talk',
      diagrams: true,
    })
  })

  it('leaves the diagram runtime off by default', () => {
    expect(parseArgs(['doc.md']).diagrams).toBe(false)
  })

  it('rejects unknown options and second inputs', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown option/)
    expect(() => parseArgs(['a.md', 'b.md'])).toThrow(/one input/)
  })
})

describe('static render', () => {
  it('produces a complete standalone document', async () => {
    const html = await render('# Title\n\nHello.\n')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>Title</title>')
    expect(html).toContain('</html>')
    expect(html).toContain('data-panel="0"')
  })

  it('highlights code in Node, with no browser involved', async () => {
    const html = await render('```ts\nconst answer: number = 42\n```\n')
    expect(html).toContain('shiki')
    // Shiki emits both themes as custom properties for the CSS-only swap.
    expect(html).toContain('--shiki-dark')
  })

  it('renders maths in Node', async () => {
    const html = await render('$$\nE = mc^2\n$$\n')
    expect(html).toContain('katex')
  })

  it('renders every promoted block kind', async () => {
    const html = await render(kitchenSink())
    for (const marker of [
      'class="cards"', 'class="stepper"', 'callout-', 'chart-figure',
      'class="comparison"', 'class="definitions"', 'class="tree"', 'md-table',
    ]) {
      expect(html, `missing ${marker}`).toContain(marker)
    }
  })

  it('carries both views and the viewer script', async () => {
    const html = await render(kitchenSink())
    expect(html).toContain('class="doc"')
    expect(html).toContain('deck-export')
    expect(html).toContain('data-action="present"')
  })

  it('emits reveal keys only for real steps', async () => {
    const html = await render('## S\n\n- a\n- b\n- c\n')
    expect(html.match(/data-reveal=/g) ?? []).toHaveLength(3)
  })

  it('omits the copy button, which would need a script to work', async () => {
    const html = await render('```ts\nconst x = 1\n```\n')
    expect(html).not.toContain('code-copy')
  })
})

describe('diagrams', () => {
  const source = '```mermaid\ngraph LR\n  A --> B\n```\n'

  it('detects whether a document has any', () => {
    expect(hasDiagrams(ir(source))).toBe(true)
    expect(hasDiagrams(ir('# No diagrams here\n'))).toBe(false)
  })

  it('shows the source when no runtime is inlined', async () => {
    const html = await render(source)
    expect(html).toContain('code-label')
    expect(html).toContain('graph LR')
    expect(html).not.toContain('mermaid.initialize')
  })

  it('emits a drawable block when a runtime is inlined', async () => {
    const html = await render(source, '/* pretend runtime */')
    expect(html).toContain('class="mermaid"')
    expect(html).toContain('mermaid.run')
  })

  it('breaks up a closing script tag inside the inlined runtime', async () => {
    const html = await render(source, 'var evil = "</script><script>alert(1)</script>"')
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('<\\/script')
  })
})

describe('static output is safe', () => {
  it('drops scripts and javascript: urls from the source document', async () => {
    const html = await render(
      '<script>alert(1)</script>\n\n<a href="javascript:alert(2)">x</a>\n\n[y](javascript:alert(3))\n',
    )
    expect(html).not.toContain('alert(1)')
    expect(html).not.toContain('alert(2)')
    expect(html).not.toContain('javascript:')
  })

  it('escapes a title that contains markup', async () => {
    const html = await renderStaticDocument(ir('x'), {
      styles: '',
      title: '</title><script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;/title&gt;')
  })
})
