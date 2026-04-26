import clsx from 'clsx'
export const C = ({ extraClass }: { extraClass: string | undefined }) => (
  <div className={clsx('base', extraClass || 'fallback')}>BB</div>
)
