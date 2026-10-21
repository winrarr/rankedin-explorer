import { useState } from 'react'
import {
  Activity,
  GitBranch,
  LineChart,
  MessageSquareText,
  Settings2,
  Trophy,
  X,
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { Preferences } from '../lib/preferences'
import type { WorkspaceMode } from '../lib/references'

type AppHeaderProps = {
  activeMode: WorkspaceMode
  preferences: Preferences
  onPreferencesChange: Dispatch<SetStateAction<Preferences>>
  onReset: () => void
  onModeChange: (mode: WorkspaceMode) => void
  onFeedbackClick: () => void
}

export function AppHeader({ activeMode, preferences, onPreferencesChange, onReset, onModeChange, onFeedbackClick }: AppHeaderProps) {
  const [showPreferences, setShowPreferences] = useState(false)
  const setPreferences = onPreferencesChange
  const resetToHome = onReset
  const switchMode = onModeChange

  return (
    <>
      <header className="topbar">
        <a className="brand" href="." aria-label="Rankedin Explorer home" onClick={(event) => { event.preventDefault(); resetToHome() }}>
          <span className="brand-mark"><Activity size={16} strokeWidth={2.5} /></span>
          <span>rankedin <strong>explorer</strong></span>
        </a>

        <div className="topbar-actions">
          <button className="feedback-action" type="button" onClick={onFeedbackClick}>
            <MessageSquareText size={14} /> <span>Send feedback</span>
          </button>
          <button
            className="icon-button quiet"
            type="button"
            aria-label="Open preferences"
            aria-expanded={showPreferences}
            onClick={() => setShowPreferences((open) => !open)}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {showPreferences && (
          <div className="preferences-popover">
            <div className="popover-heading">
              <div>
                <h3>Preferences</h3>
              </div>
              <button className="icon-button quiet" type="button" aria-label="Close preferences" onClick={() => setShowPreferences(false)}>
                <X size={16} />
              </button>
            </div>
            <label className="preference-row">
              <span>Theme</span>
              <select
                value={preferences.theme}
                onChange={(event) => setPreferences((current) => ({ ...current, theme: event.target.value as Preferences['theme'] }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Pair history depth</span>
              <select
                value={preferences.historyLimit}
                onChange={(event) => setPreferences((current) => ({ ...current, historyLimit: Number(event.target.value) as Preferences['historyLimit'] }))}
              >
                <option value={5}>5 events</option>
                <option value={10}>10 events</option>
                <option value={25}>25 events</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Table density</span>
              <select
                value={preferences.density}
                onChange={(event) => setPreferences((current) => ({ ...current, density: event.target.value as Preferences['density'] }))}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="preference-row preference-checkbox">
              <span>Open match details by default</span>
              <input
                type="checkbox"
                checked={preferences.showContext}
                onChange={(event) => setPreferences((current) => ({ ...current, showContext: event.target.checked }))}
              />
            </label>
            <p className="popover-note">Tournament and pair choices aren't saved. Player history covers up to 25 finished events.</p>
          </div>
        )}
      </header>

      <nav className="workspace-nav" aria-label="Choose workspace">
        <div className="workspace-nav-inner">
          <div className="workspace-nav-tabs" role="tablist">
            <button
              className={activeMode === 'tournament' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'tournament'}
              onClick={() => switchMode('tournament')}
            >
              <Trophy size={15} /> <span className="workspace-tab-full">Tournament Explorer</span><span className="workspace-tab-short">Tournament</span>
            </button>
            <button
              className={activeMode === 'player' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'player'}
              onClick={() => switchMode('player')}
            >
              <LineChart size={15} /> <span className="workspace-tab-full">Player Progress</span><span className="workspace-tab-short">Player</span>
            </button>
            <button
              className={activeMode === 'league' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'league'}
              onClick={() => switchMode('league')}
            >
              <GitBranch size={15} /> <span className="workspace-tab-full">Lunar League Explorer</span><span className="workspace-tab-short">League</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
