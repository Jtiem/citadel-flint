import React from 'react'
import s from './deeply/nested/button.module.css'

export function Button({ small }: { small?: boolean }) {
  return (
    <button className={`${s.btn} ${s.btnPrimary} ${small ? s.btnSmall : ''}`}>
      Click me
    </button>
  )
}
