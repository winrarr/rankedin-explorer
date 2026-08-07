import { LoaderCircle } from 'lucide-react'

type LoadingValueProps = {
  label?: string
  size?: number
}

export function LoadingValue({ label = 'Reading…', size = 14 }: LoadingValueProps) {
  return (
    <span className="loading-value">
      <LoaderCircle className="spin" size={size} aria-hidden="true" />
      {label}
    </span>
  )
}
