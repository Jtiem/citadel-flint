import React from 'react'
import s from './style.module.css'

export function Component() {
  return (
    <div className={s.card}>
      <div className={s.header}>Header</div>
      {/* s.ghost is NOT defined in style.module.css */}
      <div className={s.ghost}>Ghost content</div>
    </div>
  )
}
