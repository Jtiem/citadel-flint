import { cva } from 'class-variance-authority'
const variants = cva('', {
  variants: {
    rounded: {
      none: 'rounded-none',
      sm: 'rounded-sm',
      full: 'rounded-full',
    },
  },
})
export const C = (props: any) => <div className={variants(props)}>LL</div>
