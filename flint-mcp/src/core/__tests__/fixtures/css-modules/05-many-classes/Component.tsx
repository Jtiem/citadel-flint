import React from 'react'
import s from './style.module.css'

type Size = 'small' | 'medium' | 'large'
type Variant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'

export function Button({
  size = 'medium',
  variant = 'primary',
  loading = false,
  disabled = false,
  children,
}: {
  size?: Size
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  const classes = [
    s.base,
    s[size],
    s[variant],
    loading && s.loading,
    disabled && s.disabled,
  ]
    .filter(Boolean)
    .join(' ')

  return <button className={classes}>{children}</button>
}
