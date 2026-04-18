import clsx from 'clsx'
export const C = ({ active, dynamicClass }: { active: boolean; dynamicClass: string }) => (
  <div className={clsx(active ? 'text-blue-600' : dynamicClass)}>U</div>
)
