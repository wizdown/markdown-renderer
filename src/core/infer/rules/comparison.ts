import type { Rule } from '../types'
import { inlineText, isList } from '../helpers'
import { isSection, type MdSection } from '../../sections'
import { Slugger } from '../../slug'

/**
 * Consecutive sibling sections that are parallel in shape become side-by-side
 * columns: "Pros" / "Cons", "Before" / "After", "Option A" / "Option B".
 *
 * This is the only rule that spans more than one node, which is exactly why
 * sections get nested in normalize — matching "two adjacent headings with
 * similar bodies" on a flat list of siblings would be miserable.
 *
 * In deck mode the columns land next to each other on one panel, which is the
 * whole point: a comparison read across two scrolled screens is not a
 * comparison.
 */

const MIN_COLUMNS = 2
const MAX_COLUMNS = 3
const MAX_TITLE_CHARS = 40

/**
 * Comparisons live *inside* a topic, never at the document's spine.
 *
 * Three consecutive H2s each containing a list is an ordinary document, not a
 * comparison, and hoisting them into columns destroys the structure a reader
 * navigates by. Requiring a sub-section keeps the rule where comparisons
 * actually occur; `:::comparison` still works at any depth for the rare
 * document that really does compare two top-level sections.
 */
const MIN_DEPTH = 3

/**
 * A column body is exactly one list and nothing else. Allowing prose alongside
 * it was too permissive: sections with different content — a bullet list, a
 * definition list, a numbered procedure — all passed and got forced into
 * columns that had nothing to do with each other.
 */
function bodyList(section: MdSection): { ordered: boolean; items: number } | null {
  if (section.children.length !== 1) return null
  const [only] = section.children
  if (only === undefined || isSection(only) || !isList(only as never)) return null
  const list = only as unknown as { ordered?: boolean; children: unknown[] }
  return { ordered: list.ordered === true, items: list.children.length }
}

function isParallelBody(section: MdSection): boolean {
  return bodyList(section) !== null
}

export const comparisonRule: Rule = {
  name: 'comparison',
  match(nodes, index, ctx) {
    const first = nodes[index]
    if (first === undefined || !isSection(first)) return null
    if (!ctx.forced && first.depth < MIN_DEPTH) return null

    // Only the *start* of a run can open a comparison. Without this, a run of
    // four parallel sections would fail at index 0 and then happily match the
    // last three, which is exactly the list-of-sections case we are refusing.
    if (!ctx.forced) {
      const previous = nodes[index - 1]
      if (
        previous !== undefined &&
        isSection(previous) &&
        previous.depth === first.depth &&
        isParallelBody(previous)
      ) {
        return null
      }
    }

    const group: MdSection[] = []
    for (let cursor = index; cursor < nodes.length && group.length < MAX_COLUMNS; cursor += 1) {
      const candidate = nodes[cursor]
      if (candidate === undefined || !isSection(candidate)) break
      if (candidate.depth !== first.depth) break
      if (!ctx.forced && !isParallelBody(candidate)) break
      if (!ctx.forced && inlineText(candidate.heading.children).length > MAX_TITLE_CHARS) break
      group.push(candidate)
    }

    if (group.length < MIN_COLUMNS) return null

    if (!ctx.forced) {
      const bodies = group.map(bodyList)
      if (bodies.some((body) => body === null)) return null

      // Mixed list kinds are not parallel: a bulleted set beside a numbered
      // procedure is two different things sitting next to each other.
      if (new Set(bodies.map((body) => body?.ordered)).size > 1) return null

      // Sections of wildly different length do not belong side by side.
      const counts = bodies.map((body) => body?.items ?? 0)
      const smallest = Math.min(...counts)
      const largest = Math.max(...counts)
      if (smallest === 0 || largest > smallest * 2 + 1) return null

      // Stop at the group boundary: if a fourth parallel section follows, this
      // is a list of sections, not a comparison.
      const next = nodes[index + group.length]
      if (next !== undefined && isSection(next) && next.depth === first.depth) {
        if (isParallelBody(next)) return null
      }
    }

    const slugger = new Slugger()
    return {
      consumed: group.length,
      node: {
        ...ctx.meta(first, ctx.forced ? 'explicit' : 'rule:comparison'),
        type: 'comparison',
        columns: group.map((section) => ({
          title: ctx.inline(section.heading.children),
          slug: slugger.slug(inlineText(section.heading.children)),
          // plain(), not blocks(): a column already frames its content, and
          // promoting its list to a card grid inside it stacks one visual
          // treatment on another and squeezes both.
          children: ctx.plain(section.children),
        })),
      },
    }
  },
}
