import type {
  Blockquote,
  Code,
  Definition,
  FootnoteDefinition,
  Heading,
  List,
  Paragraph,
  PhrasingContent,
  RootContent,
  Table,
} from 'mdast'
import type {
  Diagnostic,
  IRBlock,
  IRDocument,
  IRFootnoteDefinition,
  IRHeading,
  IRInline,
  IRList,
  IRMeta,
  IRSection,
  Origin,
  PromotableKind,
} from './ir'
import { PROMOTABLE } from './ir'
import { parseMarkdown } from './parse'
import { buildSections, isSection, type MdNode, type MdSection } from './sections'
import { readCommentHint, readDirectiveHint, type Hint } from './hints'
import { forceRule, runRules } from './infer'
import type { RuleContext } from './infer/types'
import { Slugger } from './slug'
import { sanitizeHtml, isSafeUrl } from './sanitize'
import { buildTable } from './table'
import { inlineText } from './infer/helpers'

/**
 * mdast to Presentation IR. This is the only place inference happens, and the
 * last place mdast is visible — everything downstream sees IR.
 */

interface Entry {
  node: MdNode
  /** An explicit annotation attached to this node, if any. */
  hint: Hint | null
}

const PROMOTABLE_SET = new Set<string>(PROMOTABLE)

/** Line highlights in a fence's meta string: ```ts {2,4-6} */
function parseCodeMeta(meta: string | null): { title: string | null; highlightLines: number[] } {
  if (meta === null || meta === '') return { title: null, highlightLines: [] }

  const titleMatch = /(?:title|file|filename)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta)
  const title = titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? null

  const highlightLines: number[] = []
  const rangeMatch = /\{([\d,\s-]+)\}/.exec(meta)
  for (const part of (rangeMatch?.[1] ?? '').split(',')) {
    const range = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part)
    if (range === null) continue
    const from = Number(range[1])
    const to = range[2] === undefined ? from : Number(range[2])
    for (let line = from; line <= to && line - from < 500; line += 1) highlightLines.push(line)
  }

  return { title, highlightLines }
}

class Converter {
  private counter = 0
  private readonly slugger = new Slugger()
  readonly diagnostics: Diagnostic[] = []
  readonly toc: IRDocument['toc'] = []
  readonly footnotes: IRFootnoteDefinition[] = []

  constructor(private readonly definitions: Map<string, Definition>) {}

  private meta = (node: MdNode | undefined, origin: Origin): IRMeta => {
    this.counter += 1
    const position = (node as { position?: IRMeta['source'] } | undefined)?.position
    return { id: `n${this.counter}`, origin, ...(position ? { source: position } : {}) }
  }

  private warn = (message: string, node?: MdNode): void => {
    const position = (node as { position?: IRMeta['source'] } | undefined)?.position
    this.diagnostics.push({ level: 'warn', message, ...(position ? { source: position } : {}) })
  }

  // -------------------------------------------------------------------------
  // Inline
  // -------------------------------------------------------------------------

  inline = (nodes: readonly PhrasingContent[]): IRInline[] => {
    const out: IRInline[] = []
    for (const node of nodes) {
      const converted = this.inlineOne(node)
      if (converted !== null) out.push(converted)
    }
    return out
  }

  private inlineOne(node: PhrasingContent): IRInline | null {
    switch (node.type) {
      case 'text':
        return { type: 'text', value: node.value }
      case 'emphasis':
        return { type: 'emphasis', children: this.inline(node.children) }
      case 'strong':
        return { type: 'strong', children: this.inline(node.children) }
      case 'delete':
        return { type: 'delete', children: this.inline(node.children) }
      case 'inlineCode':
        return { type: 'inlineCode', value: node.value }
      case 'break':
        return { type: 'break' }
      case 'link':
        return {
          type: 'link',
          url: isSafeUrl(node.url) ? node.url : '#',
          ...(node.title ? { title: node.title } : {}),
          children: this.inline(node.children),
        }
      case 'image':
        return {
          type: 'image',
          url: isSafeUrl(node.url) ? node.url : '',
          alt: node.alt ?? '',
          ...(node.title ? { title: node.title } : {}),
        }
      case 'html':
        return { type: 'inlineHtml', value: sanitizeHtml(node.value) }
      case 'footnoteReference':
        return {
          type: 'footnoteReference',
          identifier: node.identifier,
          label: node.label ?? node.identifier,
        }
      case 'linkReference':
      case 'imageReference':
        return this.resolveReference(node)
      default: {
        // remark-math and remark-directive inline nodes.
        const typed = node as unknown as { type: string; value?: string; children?: PhrasingContent[] }
        if (typed.type === 'inlineMath') return { type: 'inlineMath', value: typed.value ?? '' }
        if (typed.children) return { type: 'text', value: inlineText(typed.children) }
        if (typeof typed.value === 'string') return { type: 'text', value: typed.value }
        return null
      }
    }
  }

  /**
   * `[text][label]` and `![alt][label]` need their matching `[label]: url`
   * definition. remark leaves them unresolved, and an unresolved reference
   * renders as its literal source text, exactly as CommonMark specifies.
   */
  private resolveReference(
    node: Extract<PhrasingContent, { type: 'linkReference' | 'imageReference' }>,
  ): IRInline {
    const definition = this.definitions.get(node.identifier.toLowerCase())

    if (definition === undefined) {
      const label = node.label ?? node.identifier
      if (node.type === 'imageReference') return { type: 'text', value: `![${node.alt ?? label}]` }
      return { type: 'text', value: `[${inlineText(node.children)}]` }
    }

    if (node.type === 'imageReference') {
      return {
        type: 'image',
        url: isSafeUrl(definition.url) ? definition.url : '',
        alt: node.alt ?? '',
        ...(definition.title ? { title: definition.title } : {}),
      }
    }
    return {
      type: 'link',
      url: isSafeUrl(definition.url) ? definition.url : '#',
      ...(definition.title ? { title: definition.title } : {}),
      children: this.inline(node.children),
    }
  }

  // -------------------------------------------------------------------------
  // Blocks
  // -------------------------------------------------------------------------

  /**
   * Pairs each node with the annotation that applies to it and drops the
   * annotation-only nodes, so rules see a clean sibling list.
   */
  private prepare(nodes: readonly MdNode[]): Entry[] {
    const entries: Entry[] = []
    let pending: Hint | null = null

    for (const node of nodes) {
      const commentHint = readCommentHint(node)
      if (commentHint !== null) {
        pending = commentHint
        continue
      }
      entries.push({ node, hint: pending ?? readDirectiveHint(node) })
      pending = null
    }
    return entries
  }

  private context(hint: Hint | null): RuleContext {
    return {
      forced: false,
      attributes: hint?.attributes ?? {},
      blocks: (nodes) => this.blocks(nodes),
      plain: (nodes) => this.plainBlocks(nodes),
      inline: this.inline,
      meta: this.meta,
      warn: this.warn,
      diagnostics: this.diagnostics,
    }
  }

  /** Convert a sibling list, running inference over it. */
  blocks = (nodes: readonly MdNode[]): IRBlock[] => {
    const entries = this.prepare(nodes)
    const nodeList = entries.map((entry) => entry.node)
    const out: IRBlock[] = []

    for (let index = 0; index < entries.length; ) {
      const entry = entries[index] as Entry
      const hint = entry.hint
      const ctx = this.context(hint)

      // A directive is a wrapper: promote what is inside it, not the wrapper.
      const unwrapped = this.unwrapDirective(entry, ctx)
      if (unwrapped !== null) {
        out.push(...unwrapped)
        index += 1
        continue
      }

      if (hint?.kind === 'prose') {
        out.push(...this.plainBlocks([entry.node]))
        index += 1
        continue
      }

      const match =
        hint !== null && PROMOTABLE_SET.has(hint.kind)
          ? forceRule(hint.kind as PromotableKind, nodeList, index, ctx)
          : runRules(nodeList, index, ctx)

      if (match !== null) {
        out.push(match.node)
        index += Math.max(1, match.consumed)
        continue
      }

      // Reaching here with a hint means the requested promotion did not apply.
      if (hint !== null) this.warn(`Cannot render this block as "${hint.kind}"`, entry.node)
      out.push(...this.plainBlocks([entry.node]))
      index += 1
    }

    return out
  }

  /** Convert without promoting the top-level nodes. Deeper levels still infer. */
  private plainBlocks(nodes: readonly MdNode[]): IRBlock[] {
    const out: IRBlock[] = []
    for (const node of nodes) {
      const converted = this.blockOne(node)
      if (converted !== null) out.push(converted)
    }
    return out
  }

  private unwrapDirective(entry: Entry, ctx: RuleContext): IRBlock[] | null {
    const { node } = entry
    if (node.type !== 'containerDirective') return null

    const children = (node as unknown as { children: RootContent[] }).children
    const hint = entry.hint

    if (hint === null) {
      const name = (node as unknown as { name: string }).name
      this.warn(`Unknown directive ":::${name}" rendered as plain content`, node)
      return this.blocks(children)
    }
    if (hint.kind === 'prose') return this.plainBlocks(children)

    const inner = this.prepare(children).map((child) => child.node)
    const match = forceRule(hint.kind as PromotableKind, inner, 0, ctx)
    if (match !== null && match.consumed >= inner.length) return [match.node]
    if (match !== null) return [match.node, ...this.blocks(inner.slice(match.consumed))]

    this.warn(`Cannot render this block as "${hint.kind}"`, node)
    return this.blocks(children)
  }

  private blockOne(node: MdNode): IRBlock | null {
    if (isSection(node)) return this.section(node)

    switch (node.type) {
      case 'heading':
        return this.heading(node as Heading)
      case 'paragraph':
        return this.paragraph(node as Paragraph)
      case 'list':
        return this.list(node as List)
      case 'code':
        return this.code(node as Code)
      case 'table':
        return buildTable(node as Table, this.inline, this.meta(node, 'markdown'))
      case 'blockquote':
        return {
          ...this.meta(node, 'markdown'),
          type: 'blockquote',
          children: this.blocks((node as Blockquote).children),
        }
      case 'thematicBreak':
        return { ...this.meta(node, 'markdown'), type: 'thematicBreak' }
      case 'html': {
        const value = sanitizeHtml(node.value)
        return value.trim() === ''
          ? null
          : { ...this.meta(node, 'markdown'), type: 'html', value }
      }
      case 'footnoteDefinition': {
        const definition = node as FootnoteDefinition
        this.footnotes.push({
          ...this.meta(node, 'markdown'),
          type: 'footnoteDefinition',
          identifier: definition.identifier,
          label: definition.label ?? definition.identifier,
          children: this.blocks(definition.children),
        })
        return null
      }
      case 'containerDirective':
      case 'leafDirective': {
        const children = (node as unknown as { children?: RootContent[] }).children ?? []
        const [first] = this.blocks(children)
        return first ?? null
      }
      default: {
        const typed = node as unknown as { type: string; value?: string }
        if (typed.type === 'math') {
          return { ...this.meta(node, 'markdown'), type: 'math', value: typed.value ?? '' }
        }
        return null
      }
    }
  }

  private heading(node: Heading): IRHeading {
    const text = inlineText(node.children)
    const slug = this.slugger.slug(text)
    this.toc.push({ slug, depth: node.depth, text })
    return {
      ...this.meta(node, 'markdown'),
      type: 'heading',
      depth: node.depth as IRHeading['depth'],
      children: this.inline(node.children),
      slug,
    }
  }

  private section(node: MdSection): IRSection {
    const heading = this.heading(node.heading)
    return {
      ...this.meta(node, 'markdown'),
      type: 'section',
      depth: node.depth,
      heading,
      children: this.blocks(node.children),
    }
  }

  /**
   * A paragraph holding nothing but an image is a figure, not a sentence with
   * a picture in it — it gets a caption and its own vertical rhythm.
   */
  private paragraph(node: Paragraph): IRBlock {
    const visible = node.children.filter(
      (child) => !(child.type === 'text' && child.value.trim() === ''),
    )
    const [only] = visible

    if (visible.length === 1 && only?.type === 'image') {
      return {
        ...this.meta(node, only.title ? 'rule:figure' : 'markdown'),
        type: 'imageBlock',
        url: isSafeUrl(only.url) ? only.url : '',
        alt: only.alt ?? '',
        title: only.title ?? null,
        caption: only.title ? [{ type: 'text', value: only.title }] : null,
      }
    }

    return {
      ...this.meta(node, 'markdown'),
      type: 'paragraph',
      children: this.inline(node.children),
    }
  }

  private list(node: List): IRList {
    return {
      ...this.meta(node, 'markdown'),
      type: 'list',
      ordered: node.ordered === true,
      start: node.start ?? null,
      spread: node.spread === true,
      children: node.children.map((item) => ({
        ...this.meta(item, 'markdown'),
        type: 'listItem' as const,
        checked: item.checked ?? null,
        children: this.blocks(item.children),
      })),
    }
  }

  private code(node: Code): IRBlock {
    const lang = node.lang ?? null
    // Mermaid is a diagram that happens to be written in a fence; it should
    // render as the picture the author meant, not as its own source.
    if (lang !== null && /^mermaid$/i.test(lang)) {
      return { ...this.meta(node, 'rule:mermaid'), type: 'mermaid', value: node.value }
    }
    if (lang !== null && /^(math|latex|katex)$/i.test(lang)) {
      return { ...this.meta(node, 'rule:math'), type: 'math', value: node.value }
    }

    const { title, highlightLines } = parseCodeMeta(node.meta ?? null)
    return {
      ...this.meta(node, 'markdown'),
      type: 'code',
      lang,
      meta: node.meta ?? null,
      title,
      highlightLines,
      value: node.value,
    }
  }
}

export function renderToIR(source: string): IRDocument {
  const { root, frontmatter, definitions } = parseMarkdown(source)
  const converter = new Converter(definitions)
  const children = converter.blocks(buildSections(root.children))

  const frontmatterTitle = typeof frontmatter.title === 'string' ? frontmatter.title : null
  const firstHeading = converter.toc.find((entry) => entry.depth === 1)?.text ?? null

  return {
    frontmatter,
    title: frontmatterTitle ?? firstHeading,
    children,
    footnotes: converter.footnotes,
    toc: converter.toc,
    diagnostics: converter.diagnostics,
  }
}
