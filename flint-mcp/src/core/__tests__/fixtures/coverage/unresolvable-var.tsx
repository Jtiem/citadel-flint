// Fixture: unresolvable CSS variable — unresolvable-var
import React from 'react'

export function Brand() {
    return (
        <div style={{ color: 'var(--brand-color)', padding: '16px' }}>
            Brand text
        </div>
    )
}
