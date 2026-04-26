import { cva } from 'class-variance-authority'
const chip = cva('inline-flex items-center', {
  variants: {
    color: {
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      green: 'bg-green-100 text-green-800',
    },
    size: {
      sm: 'text-xs px-2',
      md: 'text-sm px-3',
    },
  },
})
export const C = (props: any) => <span className={chip(props)}>JJ</span>
