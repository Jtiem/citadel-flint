import React from 'react'
import s from './style.module.css'

export function ResponsiveButtons() {
  return (
    <div className={s.stack}>
      <button className={s.responsiveBtn}>Button 1</button>
      <button className={s.responsiveBtn}>Button 2</button>
    </div>
  )
}
