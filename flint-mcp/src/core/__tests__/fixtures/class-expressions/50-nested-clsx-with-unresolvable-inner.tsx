import clsx from 'clsx'
import { importedClass } from './theme'
export const C = () => (
  <div className={clsx('outer', clsx('inner', importedClass))}>WW</div>
)
