import React from 'react'
import s from './card.module.scss'

export function Card({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className={s.card}>
      <div className={s.cardHeader}>Header</div>
      <div className={s.cardBody}>{children}</div>
      {footer && <div className={s.cardFooter}>{footer}</div>}
    </div>
  )
}
