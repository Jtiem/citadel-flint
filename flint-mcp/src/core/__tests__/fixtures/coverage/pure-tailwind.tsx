// Fixture: pure Tailwind static className literals — should produce status "parsed"
import React from 'react'

export function Button({ label }: { label: string }) {
    return (
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            {label}
        </button>
    )
}
