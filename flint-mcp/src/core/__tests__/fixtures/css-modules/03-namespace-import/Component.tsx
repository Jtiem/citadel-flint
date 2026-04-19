import React from 'react'
import * as s from './style.module.css'

export function Component() {
  return (
    <div className={s.root}>
      <h1 className={s.title}>Title</h1>
      <p className={s.subtitle}>Subtitle</p>
    </div>
  )
}
