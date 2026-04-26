import React from 'react'
import layout from './layout.module.css'
import typo from './typography.module.css'

export function PageLayout() {
  return (
    <div className={layout.grid}>
      <aside className={layout.sidebar}>
        <p className={typo.caption}>Navigation</p>
      </aside>
      <main className={layout.main}>
        <h1 className={typo.heading}>Page Title</h1>
        <p className={typo.body}>Content goes here.</p>
      </main>
    </div>
  )
}
