import { Fragment, type ReactNode } from 'react'
import type { IRInline } from '../core/ir'
import { InlineMath } from './blocks/MathBlock'

/**
 * Inline rendering. Every URL that reaches here has already been through the
 * sanitizer's scheme check in toIR, so there is no unsafe href left to guard.
 */

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function one(node: IRInline, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={key}>{node.value}</Fragment>
    case 'emphasis':
      return <em key={key}><Inline nodes={node.children} /></em>
    case 'strong':
      return <strong key={key}><Inline nodes={node.children} /></strong>
    case 'delete':
      return <del key={key}><Inline nodes={node.children} /></del>
    case 'inlineCode':
      return <code key={key} className="inline-code">{node.value}</code>
    case 'inlineMath':
      return <InlineMath key={key} value={node.value} />
    case 'break':
      return <br key={key} />
    case 'link':
      return (
        <a
          key={key}
          href={node.url}
          title={node.title}
          {...(isExternal(node.url) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <Inline nodes={node.children} />
        </a>
      )
    case 'image':
      return <img key={key} src={node.url} alt={node.alt} title={node.title} loading="lazy" />
    case 'footnoteReference':
      return (
        <sup key={key} className="footnote-ref">
          <a href={`#fn-${node.identifier}`} id={`fnref-${node.identifier}`}>
            {node.label}
          </a>
        </sup>
      )
    case 'inlineHtml':
      return <span key={key} dangerouslySetInnerHTML={{ __html: node.value }} />
    default:
      return null
  }
}

export function Inline({ nodes }: { nodes: readonly IRInline[] }): ReactNode {
  return <>{nodes.map(one)}</>
}

/** Plain-text flattening, for titles, aria labels and tooltips. */
export function inlineToText(nodes: readonly IRInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'inlineMath':
          return node.value
        case 'image':
          return node.alt
        case 'break':
          return ' '
        case 'inlineHtml':
          return ''
        case 'footnoteReference':
          return ''
        default:
          return 'children' in node ? inlineToText(node.children) : ''
      }
    })
    .join('')
}
