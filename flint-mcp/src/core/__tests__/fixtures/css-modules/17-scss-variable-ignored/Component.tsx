import React from 'react'
import s from './tokens.module.scss'

export function TokenBox({ small }: { small?: boolean }) {
  return <div className={small ? s.tokenBoxSmall : s.tokenBox}>Token Box</div>
}
