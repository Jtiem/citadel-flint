// Fixture: dynamic class expression — dynamic-class-expression
import React from 'react'
import clsx from 'clsx'

export function Alert({ type }: { type: string }) {
    return (
        <div className={clsx('alert', type === 'error' && 'alert-error')}>
            Alert
        </div>
    )
}
