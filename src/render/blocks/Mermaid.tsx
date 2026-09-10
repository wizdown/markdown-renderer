import { useEffect, useRef, useState } from 'react'
import type { IRMermaid } from '../../core/ir'
import { useTheme } from '../../ui/theme'
import { useStaticRender } from '../staticContext'

/**
 * Mermaid is loaded lazily and only when a document actually contains a
 * diagram — it is by far the heaviest dependency here, and most documents
 * never touch it.
 *
 * A diagram that fails to parse falls back to its source. That is the honest
 * outcome: the author can see what they wrote and fix it, where an empty box
 * would just look like the renderer had broken.
 */
let counter = 0

export function MermaidBlock({ block }: { block: IRMermaid }) {
  const { resolved } = useTheme()
  const { isStatic, diagramRuntime } = useStaticRender()
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const idRef = useRef(`mermaid-${(counter += 1)}`)

  useEffect(() => {
    let cancelled = false
    if (isStatic) return

    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: resolved === 'dark' ? 'dark' : 'default',
          fontFamily: 'var(--font-sans)',
        })
        const { svg: rendered } = await mermaid.render(idRef.current, block.value)
        if (!cancelled) {
          setSvg(rendered)
          setFailed(false)
        }
      } catch {
        if (!cancelled) {
          setSvg(null)
          setFailed(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [block.value, resolved, isStatic])

  if (isStatic) {
    // Mermaid needs a layout engine to measure text, so there is no way to
    // draw the diagram without a browser. Either the output carries the
    // runtime and the diagram draws itself when the file is opened, or it
    // shows the source — which is at least honest and still says what the
    // author meant.
    return diagramRuntime ? (
      <div className="mermaid-figure">
        <pre className="mermaid">{block.value}</pre>
      </div>
    ) : (
      <figure className="code-figure">
        <div className="code-bar"><span className="code-label">mermaid</span></div>
        <pre className="code-block"><code>{block.value}</code></pre>
      </figure>
    )
  }

  if (failed) {
    return (
      <figure className="code-figure">
        <div className="code-bar">
          <span className="code-label">mermaid — could not render</span>
        </div>
        <pre className="code-block"><code>{block.value}</code></pre>
      </figure>
    )
  }

  return (
    // The source travels with the element so the export can fall back to it
    // if the diagram has not finished rendering by the time it serializes.
    <div className="mermaid-figure" data-mermaid-source={block.value}>
      {svg === null ? (
        <div className="mermaid-loading">Rendering diagram…</div>
      ) : (
        <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  )
}
