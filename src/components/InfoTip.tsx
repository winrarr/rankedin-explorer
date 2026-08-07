import { Info } from 'lucide-react'

type InfoTipProps = {
  label: string
  message: string
}

export function InfoTip({ label, message }: InfoTipProps) {
  return (
    <span className="info-tip-wrap">
      <button className="info-tip" type="button" aria-label={label} title={message}>
        <Info size={13} aria-hidden="true" />
      </button>
      <span className="info-tip-message" role="tooltip">{message}</span>
    </span>
  )
}
