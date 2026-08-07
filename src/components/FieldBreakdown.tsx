import { Info } from 'lucide-react'
import type { FieldClassSummary, FieldLeagueDivisionCount } from '../lib/fieldBreakdown'

export function FieldClassSummaryGrid({ summaries }: { summaries: FieldClassSummary[] }) {
  return (
    <div className="field-aggregate-grid">
      {summaries.map((summary) => {
        const percentage = Math.round(summary.averageTopPercent * 100)
        return (
          <article className="field-aggregate-card" key={`${summary.kind}-${summary.className}`}>
            <span className="field-aggregate-class">{summary.className}</span>
            <strong>Top {percentage}%</strong>
            <span>{summary.resultCount} results · {summary.playerCount} players</span>
            <div className="field-aggregate-scale" aria-hidden="true">
              <span className="field-aggregate-marker" style={{ left: `${percentage}%` }} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function FieldLeagueDivisionSummary({
  divisions,
  missingCount,
  totalPlayers,
}: {
  divisions: FieldLeagueDivisionCount[]
  missingCount: number
  totalPlayers: number
}) {
  return (
    <>
      {divisions.length ? (
        <div className="league-field-grid">
          {divisions.map((division) => (
            <div className="league-field-row" key={division.divisionName}>
              <div className="league-field-row-heading">
                <strong>{division.divisionName}</strong>
                <span>{division.playerCount} {division.playerCount === 1 ? 'player' : 'players'}</span>
              </div>
              <div className="league-field-bar" aria-hidden="true">
                <span style={{ width: `${(division.playerCount / Math.max(totalPlayers, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="field-aggregate-empty">No current Lunar League divisions were found.</p>
      )}
      {!!missingCount && (
        <p className="field-aggregate-note"><Info size={13} /> {missingCount} {missingCount === 1 ? 'player has' : 'players have'} no current division in the public data.</p>
      )}
    </>
  )
}
