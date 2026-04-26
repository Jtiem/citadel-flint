import clsx from 'clsx'
export const C = ({ active }: { active: boolean }) => (
  <div className={clsx(active ? 'text-blue-600' : 'text-gray-400')}>T</div>
)
