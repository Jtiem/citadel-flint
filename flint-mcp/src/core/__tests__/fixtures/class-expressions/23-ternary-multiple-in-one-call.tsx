import clsx from 'clsx'
export const C = ({ active, show }: { active: boolean; show: boolean }) => (
  <div className={clsx(active ? 'x' : 'y', show && 'z')}>V</div>
)
