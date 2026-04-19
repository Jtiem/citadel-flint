import React from 'react'
import s from './style.module.css'

export function Tooltip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className={s.tooltip} data-tip={tip}>
      {children}
    </span>
  )
}
