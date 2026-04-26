import clsx from 'clsx'
export const C = ({ isActive, isDisabled, size }: any) => (
  <div className={clsx({ active: isActive, disabled: isDisabled, large: size === 'lg' })}>N</div>
)
