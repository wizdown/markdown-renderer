import type { IRBlock, IRList, IRSection } from '../core/ir'
import { Inline } from './Inline'
import { TableBlock } from './blocks/Table'
import { ChartBlock } from './blocks/Chart'
import { CodeBlock } from './blocks/CodeBlock'
import { MathBlock } from './blocks/MathBlock'
import { MermaidBlock } from './blocks/Mermaid'
import { Callout, Cards, Comparison, Definitions, Stepper, Tree } from './blocks/Promoted'
import { RevealItem, useRevealState } from './reveal'
import { OverrideChrome } from './OverrideChrome'

/**
 * The single dispatch point from IR to React. Doc mode and deck mode both come
 * through here, which is what keeps the two modes showing the same content.
 */

function ListBlock({ block }: { block: IRList }) {
  const Tag = block.ordered ? 'ol' : 'ul'
  const isTaskList = block.children.some((item) => item.checked !== null)

  return (
    <Tag
      className={[
        'md-list',
        block.spread ? 'is-loose' : 'is-tight',
        isTaskList ? 'is-tasks' : '',
      ].filter(Boolean).join(' ')}
      start={block.ordered ? block.start ?? undefined : undefined}
    >
      {block.children.map((item, index) => (
        <RevealItem key={item.id} blockId={block.id} index={index} as="li"
          className={item.checked === null ? '' : 'task-item'}>
          {item.checked !== null && (
            <input type="checkbox" checked={item.checked} readOnly aria-label="task" />
          )}
          <Blocks blocks={item.children} />
        </RevealItem>
      ))}
    </Tag>
  )
}

function Section({ block }: { block: IRSection }) {
  const Heading = `h${block.heading.depth}` as 'h1'
  return (
    <section className="md-section" data-depth={block.depth}>
      <Heading id={block.heading.slug} className="md-heading">
        <a className="heading-anchor" href={`#${block.heading.slug}`} aria-label="Link to this section">#</a>
        <Inline nodes={block.heading.children} />
      </Heading>
      <Blocks blocks={block.children} />
    </section>
  )
}

function Dispatch({ block }: { block: IRBlock }) {
  switch (block.type) {
    case 'section':
      return <Section block={block} />
    case 'heading': {
      const Heading = `h${block.depth}` as 'h1'
      return (
        <Heading id={block.slug} className="md-heading">
          <a className="heading-anchor" href={`#${block.slug}`} aria-label="Link to this heading">#</a>
          <Inline nodes={block.children} />
        </Heading>
      )
    }
    case 'paragraph':
      return <p className="md-paragraph"><Inline nodes={block.children} /></p>
    case 'list':
      return <ListBlock block={block} />
    case 'listItem':
      return <Blocks blocks={block.children} />
    case 'code':
      return <CodeBlock block={block} />
    case 'table':
      return <TableBlock block={block} />
    case 'blockquote':
      return <blockquote className="md-quote"><Blocks blocks={block.children} /></blockquote>
    case 'thematicBreak':
      return <hr className="md-rule" />
    case 'html':
      return <div className="md-html" dangerouslySetInnerHTML={{ __html: block.value }} />
    case 'math':
      return <MathBlock value={block.value} />
    case 'mermaid':
      return <MermaidBlock block={block} />
    case 'imageBlock':
      return (
        <figure className="md-figure">
          <img src={block.url} alt={block.alt} loading="lazy" />
          {block.caption !== null && (
            <figcaption><Inline nodes={block.caption} /></figcaption>
          )}
        </figure>
      )
    case 'cards':
      return <Cards block={block} />
    case 'stepper':
      return <Stepper block={block} />
    case 'callout':
      return <Callout block={block} />
    case 'chart':
      return <ChartBlock block={block} />
    case 'comparison':
      return <Comparison block={block} />
    case 'definitions':
      return <Definitions block={block} />
    case 'tree':
      return <Tree block={block} />
    case 'footnoteDefinition':
      return null
    default:
      return null
  }
}

/**
 * Itemised blocks reveal one item at a time, so the block as a whole must not
 * also be gated — otherwise its first item would need two keypresses.
 */
const SELF_REVEALING = new Set(['list', 'cards', 'stepper', 'definitions'])

export function Block({ block }: { block: IRBlock }) {
  const { isStep, pending } = useRevealState(block.id)
  const itemised = SELF_REVEALING.has(block.type)
  const gated = !itemised && pending

  return (
    <div
      className={`block${gated ? ' is-pending' : ''}`}
      aria-hidden={gated || undefined}
      {...(!itemised && isStep ? { 'data-reveal': block.id } : {})}
    >
      <OverrideChrome block={block}>
        <Dispatch block={block} />
      </OverrideChrome>
    </div>
  )
}

export function Blocks({ blocks }: { blocks: readonly IRBlock[] }) {
  return <>{blocks.map((block) => <Block key={block.id} block={block} />)}</>
}
