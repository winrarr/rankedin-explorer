import type { ReactNode } from 'react'

type CardHeadingProps = {
  kicker: ReactNode
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tools?: ReactNode
  className?: string
}

export function CardHeading({ kicker, title, description, icon, tools, className = '' }: CardHeadingProps) {
  const headingClassName = ['card-heading', className].filter(Boolean).join(' ')

  return (
    <div className={headingClassName}>
      <div>
        <div className="section-kicker">{kicker}</div>
        <h2>{title}</h2>
        {description !== undefined && <p>{description}</p>}
      </div>
      {tools ?? icon}
    </div>
  )
}
