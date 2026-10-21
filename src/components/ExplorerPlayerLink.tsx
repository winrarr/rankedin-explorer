import type { ReactNode } from 'react'
import { explorerPlayerHref } from '../lib/playerLinks'

type ExplorerPlayerLinkProps = {
  rankedInId: string | null | undefined
  name: string
  className?: string
  children?: ReactNode
}

export function ExplorerPlayerLink({ rankedInId, name, className, children }: ExplorerPlayerLinkProps) {
  if (!rankedInId) return <>{children ?? name}</>

  return (
    <a
      className={className ? `explorer-player-link ${className}` : 'explorer-player-link'}
      href={explorerPlayerHref(rankedInId)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${name} in Rankedin Explorer in a new tab`}
    >
      {children ?? name}
    </a>
  )
}
