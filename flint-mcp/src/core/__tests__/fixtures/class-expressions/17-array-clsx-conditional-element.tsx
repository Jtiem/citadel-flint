import clsx from 'clsx'
export const C = ({ cond }: { cond: boolean }) => (
  <div className={clsx(['a', 'b', cond && 'c'])}>Q</div>
)
