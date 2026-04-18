import clsx from 'clsx'
function getThemeClass(): string {
  return 'dark'
}
export const C = () => <div className={clsx('base', getThemeClass())}>RR</div>
