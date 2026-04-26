import { cva } from 'class-variance-authority'
const badge = cva('font-semibold', {
  variants: {
    variant: {
      default: 'bg-zinc-100 text-zinc-900',
      destructive: 'bg-red-500 text-white',
      outline: 'border border-zinc-200',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})
export const C = (props: any) => <span className={badge(props)}>KK</span>
