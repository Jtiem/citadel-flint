import React from 'react'
import s from './style.module.css'

export function Button({ loading }: { loading?: boolean }) {
  return (
    <button
      className={[
        s['btn-primary'],
        s.btn_large,
        s['icon-left'],
        loading ? s['is-loading'] : '',
      ].join(' ')}
    >
      Click me
    </button>
  )
}
