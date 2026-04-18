// Typical shadcn/ui utility: local cn that wraps clsx + twMerge
// The expander recognizes 'cn' as a well-known callee name
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
function cn(...inputs: any[]) { return twMerge(clsx(inputs)) }
export const C = () => <div className={cn('rounded', 'border', 'p-4')}>HH</div>
