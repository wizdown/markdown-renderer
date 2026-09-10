import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToIR } from './core/toIR'
import { buildDeck } from './core/deck'
import { applyOverride } from './core/override'
import type { IRBlock } from './core/ir'
import type { HintKind } from './core/hints'
import { DocView } from './render/DocView'
import { DeckView } from './render/DeckView'
import { OverrideProvider } from './render/OverrideChrome'
import { Toolbar, type Mode } from './ui/Toolbar'
import { Toc } from './ui/Toc'
import { exportDocument, downloadHtml } from './export/exportHtml'
import { SAMPLE } from './sample'

const STORAGE_KEY = 'markdown-renderer:source'

function readStoredSource(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SAMPLE
  } catch {
    return SAMPLE
  }
}

export function App() {
  const [source, setSource] = useState(readStoredSource)
  const [mode, setMode] = useState<Mode>('doc')
  const [showSource, setShowSource] = useState(false)
  const [showChrome, setShowChrome] = useState(false)
  const [panelIndex, setPanelIndex] = useState(0)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const docRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Parsing is fast and pure, so it just re-runs; there is no cache to
  // invalidate and no way for the view to fall behind the source.
  const document = useMemo(() => renderToIR(source), [source])
  const deck = useMemo(() => buildDeck(document), [document])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, source)
    } catch {
      // Losing the draft on reload is a real cost, but not one worth crashing
      // over in a browser that blocks storage.
    }
  }, [source])

  /** Track the heading nearest the top so the TOC and the deck agree on place. */
  useEffect(() => {
    const container = scrollRef.current
    if (container === null || mode !== 'doc') return

    const onScroll = (): void => {
      const headings = docRef.current?.querySelectorAll<HTMLElement>('[id]')
      if (headings === undefined) return
      let current: string | null = null
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 120) current = heading.id
        else break
      }
      setActiveSlug(current)
    }

    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [mode, document])

  const scrollTo = useCallback((slug: string) => {
    const target = docRef.current?.querySelector(`#${CSS.escape(slug)}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSlug(slug)
  }, [])

  /**
   * Switching modes keeps the reader's place: doc to deck opens the panel the
   * reader was looking at, deck to doc scrolls to that panel's heading. The
   * two modes address the same content by slug, which is only possible because
   * they are projections of one tree.
   */
  const changeMode = useCallback(
    (next: Mode) => {
      if (next === 'deck') {
        const found = deck.panels.findIndex((panel) => panel.slug === activeSlug)
        setPanelIndex(found >= 0 ? found : 0)
      } else {
        const slug = deck.panels[panelIndex]?.slug ?? null
        if (slug !== null) window.setTimeout(() => scrollTo(slug), 0)
      }
      setMode(next)
    },
    [deck.panels, activeSlug, panelIndex, scrollTo],
  )

  const onOverride = useCallback((block: IRBlock, kind: HintKind | null) => {
    setSource((current) => applyOverride(current, block, kind).source)
  }, [])

  const onOpenFile = useCallback(() => fileRef.current?.click(), [])

  const onFileChosen = useCallback(async (file: File | undefined) => {
    if (file === undefined) return
    setSource(await file.text())
    setPanelIndex(0)
  }, [])

  const onExport = useCallback(async () => {
    setExporting(true)
    try {
      const html = await exportDocument(document)
      downloadHtml(html, (document.title ?? 'document').toLowerCase().replace(/\s+/g, '-'))
    } finally {
      setExporting(false)
    }
  }, [document])

  // Whole-window drop, so a file can be dragged anywhere onto the app.
  useEffect(() => {
    const onDragOver = (event: DragEvent): void => event.preventDefault()
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (file !== undefined && /\.(md|markdown|txt)$/i.test(file.name)) void onFileChosen(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFileChosen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') return
      if (event.key === 'p' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        changeMode(mode === 'deck' ? 'doc' : 'deck')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, changeMode])

  return (
    <div className={`app mode-${mode}`}>
      <Toolbar
        title={document.title ?? 'Untitled'}
        mode={mode}
        onModeChange={changeMode}
        showSource={showSource}
        onToggleSource={() => setShowSource((value) => !value)}
        showChrome={showChrome}
        onToggleChrome={() => setShowChrome((value) => !value)}
        onOpenFile={onOpenFile}
        onExport={() => void onExport()}
        exporting={exporting}
        diagnostics={document.diagnostics}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        hidden
        onChange={(event) => void onFileChosen(event.target.files?.[0])}
      />

      <OverrideProvider enabled={showChrome && mode === 'doc'} onOverride={onOverride}>
        <div className="workspace">
          {showSource && (
            <section className="source-pane" aria-label="Markdown source">
              <textarea
                value={source}
                spellCheck={false}
                onChange={(event) => setSource(event.target.value)}
              />
              <p className="source-hint">
                Overrides from the Inspect menu are written back here as one-line
                <code>&lt;!-- render: … --&gt;</code> comments.
              </p>
            </section>
          )}

          {mode === 'doc' ? (
            <div className="reading-area" ref={scrollRef}>
              <Toc document={document} activeSlug={activeSlug} onNavigate={scrollTo} />
              <DocView document={document} ref={docRef} />
            </div>
          ) : (
            <DeckView
              document={document}
              panelIndex={panelIndex}
              onPanelChange={setPanelIndex}
              onExit={() => changeMode('doc')}
            />
          )}
        </div>
      </OverrideProvider>
    </div>
  )
}
