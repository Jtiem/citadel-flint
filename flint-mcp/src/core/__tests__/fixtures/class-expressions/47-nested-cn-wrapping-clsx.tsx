import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
const cn = (...args: any[]) => twMerge(clsx(args))
export const C = () => (
  <div className={cn('base', clsx('inner-a', 'inner-b'))}>TT</div>
)
