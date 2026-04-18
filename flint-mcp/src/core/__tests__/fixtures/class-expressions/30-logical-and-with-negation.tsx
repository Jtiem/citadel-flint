import clsx from 'clsx'
export const C = ({ open }: { open: boolean }) => (
  <div className={clsx('panel', !open && 'panel-hidden')}>CC</div>
)
