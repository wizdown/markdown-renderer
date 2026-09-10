/**
 * The Presentation IR.
 *
 * This is the contract between "what the content is" and "how it gets drawn".
 * Parsing produces it; every renderer (doc, deck, print, export) consumes only
 * it and never sees mdast. That separation is what lets one tree render three
 * different ways without three parsers.
 *
 * Nothing in this pipeline calls a model. Promotions are decided by the
 * structural rules in ./infer/rules, so rendering is deterministic and offline.
 */

export interface SourcePoint {
  line: number
  column: number
  offset?: number
}

export interface SourceRange {
  start: SourcePoint
  end: SourcePoint
}

/** Where a node's shape came from — surfaced in the override UI. */
export type Origin =
  /** Straight from markdown, no promotion applied. */
  | 'markdown'
  /** The author asked for it, via a `:::directive` or a `<!-- render: -->` hint. */
  | 'explicit'
  /** A structural rule promoted it; `rule:cards`, `rule:chart`, ... */
  | `rule:${string}`

export interface IRMeta {
  /** Stable within a single parse; used as React keys and override targets. */
  id: string
  origin: Origin
  source?: SourceRange
}

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

export type IRInline =
  | { type: 'text'; value: string }
  | { type: 'emphasis'; children: IRInline[] }
  | { type: 'strong'; children: IRInline[] }
  | { type: 'delete'; children: IRInline[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'break' }
  | { type: 'link'; url: string; title?: string; children: IRInline[] }
  | { type: 'image'; url: string; alt: string; title?: string }
  | { type: 'footnoteReference'; identifier: string; label: string }
  | { type: 'inlineHtml'; value: string }

// ---------------------------------------------------------------------------
// Blocks — straight from markdown
// ---------------------------------------------------------------------------

export interface IRHeading extends IRMeta {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: IRInline[]
  /** Slugified, unique per document. Anchors, TOC and deck routing use it. */
  slug: string
}

export interface IRParagraph extends IRMeta {
  type: 'paragraph'
  children: IRInline[]
}

export interface IRListItem extends IRMeta {
  type: 'listItem'
  /** null when the item is not a task-list item. */
  checked: boolean | null
  children: IRBlock[]
}

export interface IRList extends IRMeta {
  type: 'list'
  ordered: boolean
  start: number | null
  /** Loose lists wrap items in paragraphs; tight ones do not. */
  spread: boolean
  children: IRListItem[]
}

export interface IRCode extends IRMeta {
  type: 'code'
  lang: string | null
  /** Everything after the language on the fence line, e.g. `title="a.ts" {2-4}`. */
  meta: string | null
  /** Parsed out of `meta`. */
  title: string | null
  highlightLines: number[]
  value: string
}

export interface IRTableCell {
  children: IRInline[]
}

export interface IRTable extends IRMeta {
  type: 'table'
  align: (('left' | 'right' | 'center') | null)[]
  header: IRTableCell[]
  rows: IRTableCell[][]
}

export interface IRBlockquote extends IRMeta {
  type: 'blockquote'
  children: IRBlock[]
}

export interface IRThematicBreak extends IRMeta {
  type: 'thematicBreak'
}

export interface IRHtml extends IRMeta {
  type: 'html'
  /** Already run through the allowlist sanitizer. */
  value: string
}

export interface IRMath extends IRMeta {
  type: 'math'
  value: string
}

export interface IRFootnoteDefinition extends IRMeta {
  type: 'footnoteDefinition'
  identifier: string
  label: string
  children: IRBlock[]
}

export interface IRDefinitionListItem {
  term: IRInline[]
  description: IRInline[]
}

// ---------------------------------------------------------------------------
// Blocks — promoted by rules (or requested explicitly)
// ---------------------------------------------------------------------------

export interface IRCards extends IRMeta {
  type: 'cards'
  items: { children: IRBlock[] }[]
  columns: number
}

export interface IRStepper extends IRMeta {
  type: 'stepper'
  items: { children: IRBlock[] }[]
  start: number
}

export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'quote'

export interface IRCallout extends IRMeta {
  type: 'callout'
  kind: CalloutKind
  /** The `**Note:**` label, stripped from the body. */
  title: string | null
  children: IRBlock[]
}

export interface IRChart extends IRMeta {
  type: 'chart'
  variant: 'bar' | 'groupedBar' | 'line'
  /** Header of the first (categorical) column. */
  categoryLabel: string
  categories: string[]
  series: { name: string; values: (number | null)[] }[]
  /** Shared unit across every series, e.g. `{ prefix: '$', suffix: '' }`. */
  unit: { prefix: string; suffix: string }
  /** The chart is a view of a table; the table is always available underneath. */
  table: IRTable
}

export interface IRComparison extends IRMeta {
  type: 'comparison'
  columns: { title: IRInline[]; slug: string; children: IRBlock[] }[]
}

export interface IRDefinitions extends IRMeta {
  type: 'definitions'
  items: IRDefinitionListItem[]
}

export interface IRTree extends IRMeta {
  type: 'tree'
  /** The original list, rendered as a collapsible outline. */
  list: IRList
  /** Levels deeper than this start collapsed. */
  collapseBelow: number
}

export interface IRMermaid extends IRMeta {
  type: 'mermaid'
  value: string
}

export interface IRImageBlock extends IRMeta {
  type: 'imageBlock'
  url: string
  alt: string
  title: string | null
  /** Trailing italic paragraph or image title, promoted to a real caption. */
  caption: IRInline[] | null
}

// ---------------------------------------------------------------------------
// Sections and root
// ---------------------------------------------------------------------------

/**
 * Headings nest their following content. Built once, in normalize; the TOC,
 * the deck projection and section-scoped rules all read this instead of
 * re-deriving structure from a flat list.
 */
export interface IRSection extends IRMeta {
  type: 'section'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  heading: IRHeading
  children: IRBlock[]
}

export type IRBlock =
  | IRSection
  | IRHeading
  | IRParagraph
  | IRList
  | IRListItem
  | IRCode
  | IRTable
  | IRBlockquote
  | IRThematicBreak
  | IRHtml
  | IRMath
  | IRFootnoteDefinition
  | IRCards
  | IRStepper
  | IRCallout
  | IRChart
  | IRComparison
  | IRDefinitions
  | IRTree
  | IRMermaid
  | IRImageBlock

export type IRBlockType = IRBlock['type']

export interface IRDocument {
  frontmatter: Record<string, unknown>
  title: string | null
  children: IRBlock[]
  footnotes: IRFootnoteDefinition[]
  /** Collected during the walk so the TOC does not need a second traversal. */
  toc: { slug: string; depth: number; text: string }[]
  /** Non-fatal notes (unknown directive, malformed chart table, ...). */
  diagnostics: Diagnostic[]
}

export interface Diagnostic {
  level: 'info' | 'warn'
  message: string
  source?: SourceRange
}

/** Block kinds a rule can produce — i.e. what the override UI can offer. */
export const PROMOTABLE = [
  'cards',
  'stepper',
  'callout',
  'chart',
  'comparison',
  'definitions',
  'tree',
] as const

export type PromotableKind = (typeof PROMOTABLE)[number]
