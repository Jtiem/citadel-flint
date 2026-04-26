// Fixture: non-literal ternary branch — non-literal-ternary-branch
import React from 'react'

const dynamicClass = 'some-dynamic-class'

export function Toggle({ isOn }: { isOn: boolean }) {
    return (
        <button className={isOn ? 'btn-on' : dynamicClass}>
            Toggle
        </button>
    )
}
