import clsx from 'clsx'
export const C = ({ isOpen, hasError, isLoading }: any) => (
  <div className={clsx(isOpen && 'open', hasError && 'error', isLoading && 'loading')}>Z</div>
)
