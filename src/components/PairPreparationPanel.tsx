import { CircleHelp, LoaderCircle, Users } from 'lucide-react'
import type { PairRecord } from '../lib/rankedin'
import { formatCompactDate } from '../lib/formatters'
import type { PairPreparationContext } from '../lib/opponentContext'
import { CardHeading } from './CardHeading'

type PairPreparationPanelProps = {
  pair: PairRecord
  context: PairPreparationContext | null
  isLoading: boolean
  error: string | null
  requestedEvents: number
  failedEvents: number
}

function resultLabel(result: boolean | null) {
  if (result === true) return 'W'
  if (result === false) return 'L'
  return '—'
}

function meetingLabel(value: number) {
  return `${value} ${value === 1 ? 'meeting' : 'meetings'}`
}

export function PairPreparationPanel({ pair, context, isLoading, error, requestedEvents, failedEvents }: PairPreparationPanelProps) {
  const hasResults = Boolean(context?.opponents.length)

  return (
    <section className="pair-preparation-panel" aria-label={`Preparation context for ${pair.first.name} and ${pair.second.name}`}>
      <CardHeading
        kicker="PREPARATION CONTEXT"
        title="Recent opponents in this field"
        description="Checks up to five recent tournament events for the selected pair and keeps only opponents from this class."
        icon={<Users size={18} className="card-heading-icon" />}
      />

      {isLoading && (
        <div className="pair-preparation-status"><LoaderCircle className="spin" size={15} /> Reading recent match details…</div>
      )}
      {error && <div className="pair-preparation-status is-error"><CircleHelp size={15} /> {error}</div>}
      {!isLoading && !error && context && (
        <>
          <div className="pair-preparation-summary">
            <div><strong>{context.opponents.length}</strong><span>field opponents</span></div>
            <div><strong>{context.matchesWithFieldOpponents}</strong><span>matches against field</span></div>
            <div><strong>{context.wins}–{context.losses}</strong><span>recent match record</span></div>
          </div>
          {requestedEvents > 0 && (
            <p className="pair-preparation-note">
              {context.matchesChecked} matches checked across {requestedEvents} recent {requestedEvents === 1 ? 'event' : 'events'}.
              {failedEvents > 0 && ` ${failedEvents} ${failedEvents === 1 ? 'event was' : 'events were'} unavailable.`}
            </p>
          )}
          {hasResults ? (
            <div className="pair-preparation-list">
              {context.opponents.slice(0, 6).map((opponent) => (
                <div className="pair-preparation-opponent" key={opponent.id}>
                  <div>
                    <strong>{opponent.name}</strong>
                    <span>{meetingLabel(opponent.meetings)} · last {resultLabel(opponent.latestWon)} {formatCompactDate(opponent.latestDate)}</span>
                  </div>
                  <span className={`pair-preparation-record ${opponent.latestWon === true ? 'win' : opponent.latestWon === false ? 'loss' : ''}`}>
                    {opponent.wins}–{opponent.losses}{opponent.draws ? `–${opponent.draws}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pair-preparation-empty">No recent matches against another player in this field were found.</p>
          )}
        </>
      )}
    </section>
  )
}
