import React from 'react'
import s from './style.module.css'

export function Button({ children }: { children: React.ReactNode }) {
  return <button className={s.primary}>{children}</button>
}
