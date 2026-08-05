export type ThemePreference = 'light' | 'dark'
export type DensityPreference = 'comfortable' | 'compact'

export type Preferences = {
  theme: ThemePreference
  density: DensityPreference
  historyLimit: 5 | 10 | 25
  showContext: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  density: 'comfortable',
  historyLimit: 10,
  showContext: false,
}

const STORAGE_KEY = 'rankedin-explorer.preferences.v2'
const LEGACY_STORAGE_KEY = 'rankedin-explorer.preferences.v1'

export function loadPreferences(): Preferences {
  try {
    const currentStored = localStorage.getItem(STORAGE_KEY)
    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY)
    const stored = currentStored ?? legacyStored
    if (!stored) return DEFAULT_PREFERENCES

    const parsed = JSON.parse(stored) as Partial<Preferences>
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      historyLimit: parsed.historyLimit === 5 || parsed.historyLimit === 25 ? parsed.historyLimit : 10,
      showContext: currentStored ? parsed.showContext === true : false,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Private browsing or a disabled storage API should not affect the app.
  }
}
