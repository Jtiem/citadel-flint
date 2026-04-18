import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'
export const C = ({ variant }: any) => (
  <div className={twMerge(clsx('base', variant === 'primary' && 'primary'), 'override')}>UU</div>
)
