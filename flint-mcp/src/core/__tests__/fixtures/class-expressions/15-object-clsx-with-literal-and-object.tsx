import clsx from 'clsx'
export const C = ({ selected }: { selected: boolean }) => (
  <button className={clsx('btn-base', { 'btn-selected': selected, 'btn-default': !selected })}>O</button>
)
