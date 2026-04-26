import clsx from 'clsx'
export const C = ({ size }: { size: 'sm' | 'md' | 'lg' }) => (
  <div className={clsx(size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base')}>X</div>
)
