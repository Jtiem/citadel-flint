import clsx from 'clsx'
export const C = ({ variant }: { variant: 'primary' | 'secondary' }) => (
  <button className={clsx('btn', variant === 'primary' ? 'btn-primary' : 'btn-secondary')}>W</button>
)
