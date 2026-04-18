import clsx from 'clsx'
export const C = ({ disabled }: { disabled: boolean }) => (
  <button className={clsx('btn', disabled && 'btn-disabled', !disabled && 'btn-active')}>AA</button>
)
