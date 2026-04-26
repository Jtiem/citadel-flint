import { cva } from 'class-variance-authority'
const button = cva('rounded-md px-4 py-2', {
  variants: {
    intent: {
      primary: 'bg-primary-500 text-white',
      secondary: 'bg-gray-500 text-white',
    },
  },
})
export const C = ({ intent }: any) => <button className={button({ intent })}>II</button>
