import { X } from 'lucide-react'
import type { PairRecord } from '../lib/rankedin'
import { PairPreparationPanel } from './PairPreparationPanel'
import { PairUsButton } from './PairUsButton'
import { PlayerHistoryColumn } from './PlayerHistoryColumn'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'
import type { TournamentWorkspacePairState } from './tournamentTypes'

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
