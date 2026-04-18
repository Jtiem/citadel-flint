import clsx from 'clsx'
export const C = ({ active }: { active: boolean }) => (
  <div className={clsx({ foo: true, bar: false, baz: active })}>K</div>
)
