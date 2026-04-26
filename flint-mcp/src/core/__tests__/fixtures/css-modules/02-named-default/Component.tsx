import React from 'react'
import { default as s } from './style.module.css'

export function Component() {
  return (
    <div className={s.container}>
      <div className={s.wrapper}>Content</div>
    </div>
  )
}
