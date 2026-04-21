import clsx from 'clsx';
export const C = ({
  error
}: {
  error: boolean;
}) => <input className={clsx(['input-base', {
  'input-error': error,
  'input-valid': !error
}])} aria-label="[NEEDS LABEL]" />;