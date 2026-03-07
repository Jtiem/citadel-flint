import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export function Input({ className = "", ...props }: InputProps) {
    return (
        <input
            className={`w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`}
            {...props}
        />
    );
}
