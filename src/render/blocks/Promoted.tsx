import { useState } from 'react'
import type {
  IRCallout, IRCards, IRComparison, IRDefinitions, IRList, IRStepper, IRTree,
} from '../../core/ir'
import { Blocks } from '../Block'
import { Inline } from '../Inline'
import { RevealItem } from '../reveal'

/**
 * The promoted block kinds. Each one is a plain, boring component — all of the
 * judgement lives in the rules that decide *whether* to use them, and none of
 * it lives here.
 *
 * Every one of these degrades: a card containing a code block, a stepper item
 * containing a table, a comparison column containing a nested list all render
 * their children through the normal block renderer, so nothing is lost by
 * being promoted.
 */

const CALLOUT_ICONS: Record<IRCallout['kind'], string> = {
  note: 'i',
  tip: '★',
  important: '!',
  warning: '⚠',
  caution: '⛔',
  quote: '“',
}

export function Cards({ block }: { block: IRCards }) {
  return (
    <div className="cards" style={{ '--card-columns': block.columns } as React.CSSProperties}>
      {block.items.map((item, index) => (
        <RevealItem key={index} blockId={block.id} index={index} className="card">
          <Blocks blocks={item.children} />
        </RevealItem>
      ))}
    </div>
  )
}

export function Stepper({ block }: { block: IRStepper }) {
  return (
    <ol className="stepper" start={block.start}>
      {block.items.map((item, index) => (
        <RevealItem key={index} blockId={block.id} index={index} as="li" className="step">
          <span className="step-number" aria-hidden>{block.start + index}</span>
          <div className="step-body">
            <Blocks blocks={item.children} />
          </div>
        </RevealItem>
      ))}
    </ol>
  )
}

export function Callout({ block }: { block: IRCallout }) {
  return (
    <aside className={`callout callout-${block.kind}`}>
      <div className="callout-icon" aria-hidden>{CALLOUT_ICONS[block.kind]}</div>
      <div className="callout-body">
        {/* The kind is announced in text, not by the icon alone. */}
        <p className="callout-kind">{block.title ?? block.kind}</p>
        <Blocks blocks={block.children} />
      </div>
    </aside>
  )
}

export function Definitions({ block }: { block: IRDefinitions }) {
  return (
    <dl className="definitions">
      {block.items.map((item, index) => (
        <RevealItem key={index} blockId={block.id} index={index} className="definition">
          <dt><Inline nodes={item.term} /></dt>
          <dd><Inline nodes={item.description} /></dd>
        </RevealItem>
      ))}
    </dl>
  )
}

export function Comparison({ block }: { block: IRComparison }) {
  return (
    <div className="comparison" style={{ '--comparison-columns': block.columns.length } as React.CSSProperties}>
      {block.columns.map((column) => (
        <section key={column.slug} className="comparison-column">
          <h3 className="comparison-title"><Inline nodes={column.title} /></h3>
          <Blocks blocks={column.children} />
        </section>
      ))}
    </div>
  )
}

function TreeList({ list, depth, collapseBelow }: {
  list: IRList
  depth: number
  collapseBelow: number
}) {
  const Tag = list.ordered ? 'ol' : 'ul'
  return (
    <Tag className="tree-list" start={list.start ?? undefined}>
      {list.children.map((item) => {
        const nested = item.children.find((child) => child.type === 'list') as IRList | undefined
        const rest = item.children.filter((child) => child !== nested)
        return (
          <li key={item.id} className="tree-item">
            {nested === undefined ? (
              <div className="tree-leaf"><Blocks blocks={rest} /></div>
            ) : (
              <TreeBranch
                summary={<Blocks blocks={rest} />}
                open={depth < collapseBelow}
              >
                <TreeList list={nested} depth={depth + 1} collapseBelow={collapseBelow} />
              </TreeBranch>
            )}
          </li>
        )
      })}
    </Tag>
  )
}

function TreeBranch({ summary, open, children }: {
  summary: React.ReactNode
  open: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(open)
  return (
    <div className={`tree-branch${expanded ? ' is-open' : ''}`}>
      <button
        type="button"
        className="tree-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="tree-caret" aria-hidden>▸</span>
        <span className="tree-summary">{summary}</span>
      </button>
      {/* Rendered always and hidden when collapsed, so the export's script can
          toggle it without React. */}
      <div className="tree-children" hidden={!expanded}>{children}</div>
    </div>
  )
}

export function Tree({ block }: { block: IRTree }) {
  return (
    <div className="tree">
      <TreeList list={block.list} depth={1} collapseBelow={block.collapseBelow} />
    </div>
  )
}
