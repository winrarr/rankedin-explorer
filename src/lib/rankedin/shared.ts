import type {
  PlayerRecord,
  PairRecord,
  NormalizedCompetitionClass,
  RawPlayer,
  RawParticipant,
} from './types'

export function parseRankedinDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (!match) return new Date(value).getTime()
  const [, day, month, year, hours = '00', minutes = '00'] = match
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`).getTime()
}

export function rankedInIdFromPlayerUrl(url: string) {
  return url.match(/\/player\/(R\d+)/i)?.[1]?.toUpperCase() ?? null
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

export function normalizePlayer(player: RawPlayer): PlayerRecord {
  return {
    id: player.Id,
    rankedInId: player.RankedinId,
    name: player.Name,
    url: player.PlayerUrl,
    rating: player.RatingBegin,
  }
}

export function normalizePair(participant: RawParticipant, index: number): PairRecord {
  return {
    id: `${participant.Participant.FirstPlayer.Id}-${participant.Participant.SecondPlayer.Id}-${index}`,
    first: normalizePlayer(participant.Participant.FirstPlayer),
    second: normalizePlayer(participant.Participant.SecondPlayer),
    ranking: participant.Ranking ? Number(participant.Ranking) : null,
  }
}

export function sportName(sport: number) {
  const sports: Record<number, string> = {
    1: 'Squash',
    2: 'Badminton',
    3: 'Table tennis',
    4: 'Tennis',
    5: 'Padel',
    6: 'Racquetball',
    7: 'Soccer squash',
    8: 'Fronton',
    9: 'Teqball',
    10: 'Crossminton',
    11: 'Pickleball',
    12: 'Roundnet',
  }

  return sports[sport] ?? 'Racket sport'
}

function cleanedCompetitionClassName(value: string) {
  return value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*-\s*(?:formiddag|eftermiddag|ftm|først til mølle).*$/i, '')
    .replace(/\s*-\s*maks.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function competitionClassGender(value: string) {
  if (/\b(?:mix|mixed)\b/i.test(value)) return 'Mix'
  if (/\b(?:girls?|piger?|flickor?)\b/i.test(value)) return 'Piger'
  if (/\b(?:boys?|drenge?|pojkar?)\b/i.test(value)) return 'Drenge'
  if (/\b(?:kvinder?|damer?|women?|female)\b/i.test(value)) return 'Kvinder'
  if (/\b(?:herrer?|herre|men|male)\b/i.test(value)) return 'Herrer'
  return null
}

function competitionClassAge(value: string) {
  const underAge = value.match(/\bU\s*(\d{1,2})\b/i)
  if (underAge) return Number(underAge[1])

  const namedAge = value.match(/\b(?:boys?|girls?|drenge?|piger?|pojkar?|flickor?)\s*(\d{1,2})\b/i)
  return namedAge ? Number(namedAge[1]) : null
}

export function normalizeCompetitionClassName(className: string | null): NormalizedCompetitionClass {
  if (!className?.trim()) return { name: 'Class unavailable', kind: 'other' }

  const cleanedName = cleanedCompetitionClassName(className)
  if (/\blunar\s+(?:ligaen|league)\b/i.test(className)) {
    return { name: 'Lunar League', kind: 'league' }
  }

  const levelMatch = className.match(/\b(?:DPF|DFP)\s*(\d{1,4})/i)
  const level = levelMatch ? `DPF${Number(levelMatch[1])}` : null
  const age = competitionClassAge(className)
  const gender = competitionClassGender(className)

  if (level) {
    return {
      name: [level, age ? `U${age}` : null, gender].filter(Boolean).join(' '),
      kind: 'dpf',
    }
  }

  if (age) {
    return {
      name: [`U${age}`, gender].filter(Boolean).join(' '),
      kind: 'junior',
    }
  }

  if (gender) return { name: gender, kind: 'category' }

  return { name: cleanedName || 'Class unavailable', kind: 'other' }
}
