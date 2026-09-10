import type { Diagnostic } from '../core/ir'
import { useTheme, type ThemePreference } from './theme'

export type Mode = 'doc' | 'deck'

export interface ToolbarProps {
  title: string
  mode: Mode
  onModeChange: (mode: Mode) => void
  showSource: boolean
  onToggleSource: () => void
  showChrome: boolean
  onToggleChrome: () => void
  onOpenFile: () => void
  onExport: () => void
  exporting: boolean
  diagnostics: Diagnostic[]
}

const THEMES: ThemePreference[] = ['light', 'system', 'dark']
const THEME_LABEL: Record<ThemePreference, string> = {
  light: 'Light',
  system: 'Auto',
  dark: 'Dark',
}

export function Toolbar(props: ToolbarProps) {
  const { preference, setPreference } = useTheme()
  const warnings = props.diagnostics.filter((entry) => entry.level === 'warn')

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-title" title={props.title}>{props.title}</span>
        {warnings.length > 0 && (
          <span
            className="toolbar-warning"
            title={warnings.map((entry) => entry.message).join('\n')}
          >
            {warnings.length} note{warnings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="toolbar-group toolbar-center">
        <div className="segmented" role="group" aria-label="View mode">
          <button
            type="button"
            className={props.mode === 'doc' ? 'is-active' : ''}
            aria-pressed={props.mode === 'doc'}
            onClick={() => props.onModeChange('doc')}
          >
            Read
          </button>
          <button
            type="button"
            className={props.mode === 'deck' ? 'is-active' : ''}
            aria-pressed={props.mode === 'deck'}
            onClick={() => props.onModeChange('deck')}
          >
            Present
          </button>
        </div>
      </div>

      <div className="toolbar-group toolbar-end">
        <button type="button" onClick={props.onOpenFile}>Open</button>
        <button
          type="button"
          className={props.showSource ? 'is-active' : ''}
          aria-pressed={props.showSource}
          onClick={props.onToggleSource}
        >
          Source
        </button>
        <button
          type="button"
          className={props.showChrome ? 'is-active' : ''}
          aria-pressed={props.showChrome}
          onClick={props.onToggleChrome}
          title="Show which rule produced each promoted block, and change it"
        >
          Inspect
        </button>
        <button type="button" onClick={props.onExport} disabled={props.exporting}>
          {props.exporting ? 'Exporting…' : 'Export'}
        </button>

        <div className="segmented" role="group" aria-label="Theme">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              className={preference === value ? 'is-active' : ''}
              aria-pressed={preference === value}
              onClick={() => setPreference(value)}
            >
              {THEME_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
