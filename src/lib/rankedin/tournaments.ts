import { query, request } from './request'
import { normalizePair, sportName } from './shared'
import type {
  TournamentSearchResult,
  TournamentSnapshot,
  RawTournamentSearchResult,
  RawPlayersResponse,
  RawHeader,
  RawStandingResponse,
} from './types'

export function parseTournamentReference(value: string) {
  const trimmed = value.trim()
  const directId = /^\d+$/.test(trimmed) ? Number(trimmed) : null
  if (directId) return { tournamentId: directId }

  const match = trimmed.match(/\/tournament\/(\d+)/i) ?? trimmed.match(/\b(\d{3,})\b/)
  if (!match) throw new Error('Paste a Rankedin tournament URL or numeric tournament ID.')

  return { tournamentId: Number(match[1]) }
}

export async function searchTournamentsByName(term: string, take = 8, signal?: AbortSignal): Promise<TournamentSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawTournamentSearchResult[]>(
    `/Search/GetTournamentsAsync${query({ term: normalizedTerm, language: 'en', take, skip: 0 })}`,
    signal,
  )

  return response.flatMap((tournament) => {
    try {
      const { tournamentId } = parseTournamentReference(tournament.Url)
      return [{
        id: tournamentId,
        name: tournament.Name,
        url: tournament.Url,
        startDate: tournament.StartDate ?? '',
        sport: tournament.Sport,
        countryFlag: tournament.CountryFlag,
        isPremium: tournament.IsPremium,
      }]
    } catch {
      return []
    }
  })
}

export async function getClassParticipants(tournamentId: number, classId: number) {
  const response = await request<RawPlayersResponse>(
    `/tournament/GetPlayersForClassAsync${query({
      tournamentId,
      tournamentClassId: classId,
      language: 'en',
    })}`,
  )

  return response.Participants.map(normalizePair)
}

export async function getTournamentSnapshot(
  reference: string,
  selectedClassId?: number,
): Promise<TournamentSnapshot> {
  const { tournamentId } = parseTournamentReference(reference)
  const [header, standings] = await Promise.all([
    request<RawHeader>(`/tournament/GetheaderAsync${query({ id: tournamentId, language: 'en' })}`),
    request<RawStandingResponse>(`/tournament/GetStandingsAsync${query({ id: tournamentId })}`),
  ])

  const classes = standings.Classes.map((item) => ({
    id: item.Id,
    name: item.Name,
    participantsType: item.ParticipantsType,
  }))
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ??
    classes.find((item) => item.name.toLowerCase().includes('mix')) ??
    classes[0]

  if (!selectedClass) throw new Error('This tournament has no public classes yet.')

  return {
    tournamentId,
    name: header.Name,
    location: header.City,
    country: header.Country,
    sport: sportName(header.Sport),
    startDate: header.StartDate,
    endDate: header.EndDate,
    state: header.EventState,
    isPremium: header.IsPremium,
    classes,
    selectedClass,
    participants: await getClassParticipants(tournamentId, selectedClass.id),
  }
}
