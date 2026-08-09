import { buildTournamentExport, type TournamentExport, type TournamentExportInput } from './exports'
import type {
  PairRecord,
  PlayerAnalysis,
  PlayerLeagueDivision,
  TournamentSnapshot,
} from './rankedin'

const SNAPSHOT_HASH_PREFIX = '#snapshot='
const GZIP_PAYLOAD_PREFIX = 'g.'
const RAW_PAYLOAD_PREFIX = 'r.'

export type RestoredTournamentSnapshot = {
  snapshot: TournamentSnapshot
  averageRating: number | null
  fieldPlacementSummaries: Record<number, PlayerAnalysis | null>
  fieldLeagueDivisions: Record<number, PlayerLeagueDivision | null>
  fieldPlacementsLoaded: boolean
  fieldLeagueDivisionsLoaded: boolean
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function blobFromBytes(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer])
}

async function compressText(value: string) {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompressText(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed snapshots.')
  const stream = blobFromBytes(bytes).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

function parseSnapshotReport(value: string): TournamentExport {
  const report: unknown = JSON.parse(value)
  if (!report || typeof report !== 'object' || (report as { exportVersion?: unknown }).exportVersion !== 1) {
    throw new Error('This snapshot is not a supported Rankedin Explorer report.')
  }
  return report as TournamentExport
}

export function readSnapshotPayload() {
  if (typeof window === 'undefined' || !window.location.hash.startsWith(SNAPSHOT_HASH_PREFIX)) return null
  return window.location.hash.slice(SNAPSHOT_HASH_PREFIX.length)
}

export async function encodeTournamentSnapshot(report: TournamentExport) {
  const json = JSON.stringify(report)
  const compressed = await compressText(json)
  if (compressed) return `${GZIP_PAYLOAD_PREFIX}${bytesToBase64Url(compressed)}`
  return `${RAW_PAYLOAD_PREFIX}${bytesToBase64Url(new TextEncoder().encode(json))}`
}

export async function decodeTournamentSnapshot(payload: string) {
  const [encoding, encodedValue] = payload.split('.', 2)
  if (!encoding || !encodedValue) throw new Error('The snapshot link is incomplete.')

  const bytes = base64UrlToBytes(encodedValue)
  const json = encoding === 'g'
    ? await decompressText(bytes)
    : encoding === 'r'
      ? new TextDecoder().decode(bytes)
      : null
  if (json === null) throw new Error('This snapshot link uses an unsupported encoding.')
  return parseSnapshotReport(json)
}

export async function buildTournamentSnapshotUrl(input: TournamentExportInput) {
  if (typeof window === 'undefined') throw new Error('Snapshots can only be created in a browser.')
  const report = buildTournamentExport(input)
  const payload = await encodeTournamentSnapshot(report)
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `${SNAPSHOT_HASH_PREFIX.slice(1)}${payload}`
  return url.toString()
}

function profilePath(profileUrl: string) {
  try {
    return new URL(profileUrl).pathname
  } catch {
    return profileUrl.startsWith('/') ? profileUrl : ''
  }
}

function restorePlayerAnalysis(playerId: number, playerName: string, results: NonNullable<TournamentExport['pairs'][number]['players'][number]['recentResults']>): PlayerAnalysis {
  return {
    playerId,
    playerName,
    events: results.map((result) => ({
      id: result.eventId,
      name: result.event,
      startDate: result.date,
      className: result.rawClass ?? result.normalizedClass,
      standing: result.placement,
      standingRangeTo: result.placementRangeTo,
      fieldSize: result.fieldSize,
      ratingBegin: null,
      ratingEnd: null,
      rankingPoints: null,
      partner: result.partner,
      matchQuery: null,
      matches: [],
    })),
  }
}

function restoreFieldLeagueDivisions(report: TournamentExport) {
  const divisions: Record<number, PlayerLeagueDivision | null> = {}
  report.lunarLeague.players.forEach((player) => {
    divisions[player.playerId] = player.division ? { divisionName: player.division } : null
  })
  return divisions
}

export function restoreTournamentSnapshot(report: TournamentExport): RestoredTournamentSnapshot {
  const pairs: PairRecord[] = report.pairs.map((pair) => ({
    id: pair.id,
    ranking: pair.ranking,
    first: {
      id: pair.players[0].id,
      rankedInId: pair.players[0].rankedInId,
      name: pair.players[0].name,
      url: profilePath(pair.players[0].profileUrl),
      rating: pair.players[0].ratingAtEntry,
    },
    second: {
      id: pair.players[1].id,
      rankedInId: pair.players[1].rankedInId,
      name: pair.players[1].name,
      url: profilePath(pair.players[1].profileUrl),
      rating: pair.players[1].ratingAtEntry,
    },
  }))
  const fieldPlacementSummaries: Record<number, PlayerAnalysis | null> = {}
  report.pairs.flatMap((pair) => pair.players).forEach((player) => {
    fieldPlacementSummaries[player.id] = player.recentResults === null
      ? null
      : restorePlayerAnalysis(player.id, player.name, player.recentResults)
  })

  return {
    snapshot: {
      tournamentId: report.tournament.id,
      name: report.tournament.name,
      location: report.tournament.location,
      country: report.tournament.country,
      sport: report.tournament.sport,
      startDate: report.tournament.startDate,
      endDate: report.tournament.endDate,
      state: report.tournament.state,
      isPremium: report.tournament.isPremium,
      classes: report.tournament.classes,
      selectedClass: report.tournament.selectedClass,
      participants: pairs,
    },
    averageRating: report.summary.averageSkill,
    fieldPlacementSummaries,
    fieldLeagueDivisions: restoreFieldLeagueDivisions(report),
    fieldPlacementsLoaded: report.summary.dataStatus.recentForm === 'complete',
    fieldLeagueDivisionsLoaded: report.summary.dataStatus.lunarLeague === 'complete',
  }
}

const MAX_IS_GD_REQUEST_LENGTH = 7500
const IS_GD_TIMEOUT_MS = 4000
type ShortLinkService = 'is.gd'

export type ShortenedSnapshotLink = {
  service: ShortLinkService
  url: string
}

function validateShortUrl(value: unknown, hostname: string) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === hostname ? url.toString() : null
  } catch {
    return null
  }
}

function shortenWithIsGd(longUrl: string) {
  return new Promise<string>((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('is.gd shortening requires a browser.'))
      return
    }

    const callbackName = `__rankedinSnapshot_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.remove()
      delete (window as unknown as Record<string, unknown>)[callbackName]
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('is.gd did not respond in time.'))
    }, IS_GD_TIMEOUT_MS)

    ;(window as unknown as Record<string, unknown>)[callbackName] = (result: unknown) => {
      cleanup()
      const value = result && typeof result === 'object' ? (result as { shorturl?: unknown }).shorturl : null
      const url = validateShortUrl(value, 'is.gd')
      if (!url) {
        reject(new Error('is.gd did not return a valid short link.'))
        return
      }
      resolve(url)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('is.gd could not be reached.'))
    }
    script.src = `https://is.gd/create.php?format=json&callback=${callbackName}&url=${encodeURIComponent(longUrl)}`
    if (script.src.length > MAX_IS_GD_REQUEST_LENGTH) {
      cleanup()
      reject(new Error('The snapshot is too long for is.gd.'))
      return
    }
    document.head.append(script)
  })
}

export async function shortenSnapshotUrl(longUrl: string): Promise<ShortenedSnapshotLink> {
  return { service: 'is.gd', url: await shortenWithIsGd(longUrl) }
}

export function snapshotShorteningError() {
  return 'is.gd could not shorten this snapshot. The full snapshot link was copied instead.'
}
