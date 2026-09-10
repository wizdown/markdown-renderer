import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import { parse as parseYaml } from 'yaml'
import type { Root, Definition, FootnoteDefinition, Yaml } from 'mdast'

/**
 * Markdown text to mdast. This is the only stage that knows about markdown
 * syntax; everything downstream works on the tree.
 *
 * The plugin set is fixed and local — no network, no model, no plugin that
 * needs either. Rendering a document offline must always produce the same tree.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml', 'toml'])
  .use(remarkDirective)
  .use(remarkMath)

export interface ParseResult {
  root: Root
  frontmatter: Record<string, unknown>
  /** `[label]: url` definitions, keyed by lowercased identifier. */
  definitions: Map<string, Definition>
  footnoteDefinitions: FootnoteDefinition[]
}

function collect(root: Root): Pick<ParseResult, 'definitions' | 'footnoteDefinitions'> {
  const definitions = new Map<string, Definition>()
  const footnoteDefinitions: FootnoteDefinition[] = []

  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    const typed = node as { type?: string; children?: unknown[] }
    if (typed.type === 'definition') {
      const def = node as Definition
      definitions.set(def.identifier.toLowerCase(), def)
    } else if (typed.type === 'footnoteDefinition') {
      footnoteDefinitions.push(node as FootnoteDefinition)
    }
    for (const child of typed.children ?? []) walk(child)
  }

  walk(root)
  return { definitions, footnoteDefinitions }
}

function readFrontmatter(root: Root): Record<string, unknown> {
  const first = root.children[0]
  if (first?.type !== 'yaml') return {}
  try {
    const parsed: unknown = parseYaml((first as Yaml).value)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    // Malformed frontmatter is the author's problem, not a reason to fail the
    // whole render — the block just contributes nothing.
    return {}
  }
}

export function parseMarkdown(source: string): ParseResult {
  const root = processor.parse(source) as Root
  return { root, frontmatter: readFrontmatter(root), ...collect(root) }
}
