import clsx from 'clsx'
export const C = ({ show }: { show: boolean }) => (
  <div className={clsx(show && 'visible')}>Y</div>
)
