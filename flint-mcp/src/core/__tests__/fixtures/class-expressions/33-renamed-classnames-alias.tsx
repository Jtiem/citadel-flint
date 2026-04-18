import cx from 'classnames'
export const C = ({ active }: { active: boolean }) => (
  <div className={cx('tab', active && 'tab-active')}>FF</div>
)
