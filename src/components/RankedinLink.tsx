import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

const RANKEDIN_ORIGIN = 'https://www.rankedin.com'

function rankedInUrl(path: string) {
  return path.startsWith('http') ? path : `${RANKEDIN_ORIGIN}${path}`
}

type RankedinLinkProps = {
  path: string
  children?: ReactNode
  className?: string
  ariaLabel?: string
  iconSize?: number
  showIcon?: boolean
}

export function RankedinLink({ path, children, className, ariaLabel, iconSize = 13, showIcon = true }: RankedinLinkProps) {
  return (
    <a className={className} href={rankedInUrl(path)} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
      {children}
      {showIcon && <ArrowUpRight size={iconSize} aria-hidden="true" />}
    </a>
  )
}
