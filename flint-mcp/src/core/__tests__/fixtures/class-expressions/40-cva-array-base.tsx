import { cva } from 'class-variance-authority'
const card = cva(['relative', 'overflow-hidden', 'rounded-lg'], {
  variants: {
    shadow: {
      none: 'shadow-none',
      sm: 'shadow-sm',
      md: 'shadow-md',
    },
  },
})
export const C = (props: any) => <div className={card(props)}>MM</div>
