import { LoaderCircle } from 'lucide-react'
import type { PairRecord } from '../lib/rankedin'

type PairUsButtonProps = {
  pair: PairRecord
  selected: boolean
  isLoading: boolean
  disabled: boolean
  onToggle: () => void
}

export function PairUsButton({ pair, selected, isLoading, disabled, onToggle }: PairUsButtonProps) {
  const pairName = pair.first.name + ' and ' + pair.second.name

  return (
    <button
      className={'us-select-button' + (selected ? ' is-selected' : '')}
      type="button"
      aria-label={selected ? 'Remove ' + pairName + ' as us' : 'Set ' + pairName + ' as us'}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
    >
      {isLoading && <LoaderCircle className="spin" size={13} />}
      {selected ? 'Us selected' : 'Set as us'}
    </button>
  )
}
