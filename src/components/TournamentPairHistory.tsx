import { X } from 'lucide-react'
import type { PairRecord } from '../lib/rankedin'
import { PairPreparationPanel } from './PairPreparationPanel'
import { PairUsButton } from './PairUsButton'
import { PlayerHistoryColumn } from './PlayerHistoryColumn'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'
import { InfoTip } from './InfoTip'
import type { TournamentWorkspacePairState } from './tournamentTypes'
import { formatCompactDate } from '../lib/formatters'

type TournamentPairHistoryProps = {
  selectedPair: PairRecord | undefined
  state: TournamentWorkspacePairState
  showContext: boolean
  onToggleUsPair: (pair: PairRecord) => void
  onClose: () => void
}

export function TournamentPairHistory({
  selectedPair,
  state,
  showContext,
  onToggleUsPair,
  onClose,
}: TournamentPairHistoryProps) {
  if (!selectedPair) return null

  const isUsPair = state.usPairId === selectedPair.id
  const isPreparing = state.isLoadingPreparation
  const history = state.history

  return (
    <section className="history-card pair-history-panel" aria-label={`Pair history for ${selectedPair.first.name} and ${selectedPair.second.name}`}>
      <div className="card-heading card-heading-small">
        <div>
          <div className="section-kicker">PAIR HISTORY</div>
          <h2>
            <ExplorerPlayerLink rankedInId={selectedPair.first.rankedInId} name={selectedPair.first.name}>{selectedPair.first.name}</ExplorerPlayerLink>
            {' + '}
            <ExplorerPlayerLink rankedInId={selectedPair.second.rankedInId} name={selectedPair.second.name}>{selectedPair.second.name}</ExplorerPlayerLink>
          </h2>
        </div>
        <div className="pair-history-actions">
          <PairUsButton
            pair={selectedPair}
            selected={isUsPair}
            isLoading={isPreparing && isUsPair}
            disabled={isPreparing || (!history?.first.analysis && state.isLoadingHistory)}
            onToggle={() => onToggleUsPair(selectedPair)}
          />
          <button className="icon-button quiet" type="button" onClick={onClose} aria-label="Close pair history"><X size={17} /></button>
        </div>
      </div>

      <section className="pair-tournament-games" aria-label="Selected tournament games">
        <div className="pair-tournament-games-heading">
          <div>
            <div className="section-kicker">SELECTED TOURNAMENT GAMES</div>
            <p>Games for this pair in the tournament class <InfoTip label="About selected tournament games" message="Only games played by both selected players together are listed. Rankedin may not publish match details for every class." /></p>
          </div>
          <span aria-live="polite">{state.isLoadingTournamentGames ? 'Loading…' : state.tournamentGames ? `${state.tournamentGames.length} games` : '—'}</span>
        </div>
        {state.tournamentGamesError && <p className="pair-tournament-games-empty" role="alert">{state.tournamentGamesError}</p>}
        {!state.isLoadingTournamentGames && !state.tournamentGamesError && state.tournamentGames?.length === 0 && (
          <p className="pair-tournament-games-empty">No published games were found for this pair in the selected class.</p>
        )}
        {!!state.tournamentGames?.length && (
          <div className="pair-tournament-games-list">
            {state.tournamentGames.map((match) => (
              <div className="pair-tournament-game" key={match.id}>
                <span className={`match-result ${match.won === true ? 'win' : match.won === false ? 'loss' : ''}`}>
                  {match.won === true ? 'W' : match.won === false ? 'L' : '—'}
                </span>
                <div>
                  <strong>{match.opponents.length ? `vs ${match.opponents.join(' + ')}` : 'Opponent unavailable'}</strong>
                  <span>{match.draw || match.className} · {formatCompactDate(match.date)}</span>
                </div>
                <span className="pair-tournament-game-score">{match.score}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pair-history-grid">
        <PlayerHistoryColumn
          player={selectedPair.first}
          analysis={history?.first.analysis ?? null}
          error={history?.first.error ?? null}
          isLoading={state.isLoadingHistory}
          showContext={showContext}
        />
        <PlayerHistoryColumn
          player={selectedPair.second}
          analysis={history?.second.analysis ?? null}
          error={history?.second.error ?? null}
          isLoading={state.isLoadingHistory}
          showContext={showContext}
        />
      </div>
      {isUsPair && (
        <PairPreparationPanel
          pair={selectedPair}
          context={state.preparation?.context ?? null}
          isLoading={isPreparing}
          error={state.preparationError}
          requestedEvents={state.preparation?.requestedEvents ?? 0}
          failedEvents={state.preparation?.failedEvents ?? 0}
        />
      )}
    </section>
  )
}
