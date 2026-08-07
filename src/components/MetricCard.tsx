import type { ReactNode } from 'react'

type MetricCardProps = {
  label: string
  value: ReactNode
  detail: string
  icon: ReactNode
  dark?: boolean
}

export function MetricCard({ label, value, detail, icon, dark = false }: MetricCardProps) {
  return (
    <div className={`metric-card ${dark ? 'metric-card-dark' : ''}`}>
      <div className="metric-label">{icon} {label}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  )
}
