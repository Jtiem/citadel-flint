import clsx from 'clsx'
// The global `cn` identifier (not imported from clsx) should be recognized
// if it is in the well-known callee list
const cn = clsx
export const C = () => <div className={cn('text-zinc-900', 'bg-white')}>J</div>
