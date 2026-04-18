import clsx from 'clsx'
export const C = ({ show }: { show: boolean }) => (
  <span className={clsx(['text-sm', 'font-medium', show ? 'visible' : 'hidden'])}>R</span>
)
