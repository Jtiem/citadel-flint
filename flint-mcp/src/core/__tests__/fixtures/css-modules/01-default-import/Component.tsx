import React from 'react'
import s from './style.module.css'

export function Component({ isActive }: { isActive: boolean }) {
  return (
    <div className={isActive ? s.active : s.hidden}>
      Hello World
    </div>
  )
}
