import React from 'react'
// This import has no .module.css extension — it is NOT a CSS Modules import.
// The resolver should NOT include this in its output.
import s from './style'

export function Component() {
  return <div className={s.active}>Hello</div>
}
