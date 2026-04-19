import React from 'react'
// Import from a 'shared' subdirectory — still inside the project root
import s from './shared/button.module.css'

export function Component({ disabled }: { disabled?: boolean }) {
  return (
    <button className={disabled ? s.sharedBtnDisabled : s.sharedBtn}>
      Button
    </button>
  )
}
