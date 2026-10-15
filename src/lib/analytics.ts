type LookupKind = 'tournament' | 'player' | 'league'

type GoatCounterEvent = {
  path: string
  title: string
  event: true
  no_session: true
}

declare global {
  interface Window {
    goatcounter?: {
      count?: (event: GoatCounterEvent) => void
    }
  }
}

const GOATCOUNTER_SCRIPT_ID = 'goatcounter-script'
const LOOKUP_EVENTS: Record<LookupKind, Omit<GoatCounterEvent, 'event' | 'no_session'>> = {
  tournament: { path: 'lookup-tournament', title: 'Tournament lookup' },
  player: { path: 'lookup-player', title: 'Player lookup' },
  league: { path: 'lookup-lunar-league', title: 'Lunar League lookup' },
}

let isEnabled = false
let pendingLookups: LookupKind[] = []

function sendLookup(kind: LookupKind) {
  window.goatcounter?.count?.({ ...LOOKUP_EVENTS[kind], event: true, no_session: true })
}

function flushPendingLookups() {
  pendingLookups.forEach(sendLookup)
  pendingLookups = []
}

export function initializeAnalytics(siteCode = import.meta.env.VITE_GOATCOUNTER_CODE) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const code = siteCode?.trim()
  if (!code || !/^[a-z0-9-]+$/i.test(code)) return

  isEnabled = true
  if (document.getElementById(GOATCOUNTER_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = GOATCOUNTER_SCRIPT_ID
  script.async = true
  script.src = 'https://gc.zgo.at/count.js'
  script.dataset.goatcounter = `https://${code}.goatcounter.com/count`
  script.dataset.goatcounterSettings = JSON.stringify({ path: '/app' })
  script.addEventListener('load', flushPendingLookups, { once: true })
  script.addEventListener('error', () => {
    isEnabled = false
    pendingLookups = []
  }, { once: true })
  document.head.append(script)
}

export function trackSuccessfulLookup(kind: LookupKind) {
  if (!isEnabled) return
  if (!window.goatcounter?.count) {
    pendingLookups.push(kind)
    return
  }
  sendLookup(kind)
}
