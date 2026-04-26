// Fixture: CSS Modules reference — css-modules-reference
import React from 'react'
import s from './Button.module.css'

export function Button({ active }: { active: boolean }) {
    return <button className={s.active}>Click</button>
}
