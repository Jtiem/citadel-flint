import clsx from 'clsx'
let dynamicClass = 'initial'
if (Math.random() > 0.5) {
  dynamicClass = 'variant'
}
export const C = () => <div className={clsx('base', dynamicClass)}>QQ</div>
