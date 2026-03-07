import React from "react";

export interface SelectOption {
    label: string;
    value: string;
}

export interface SelectFieldProps
    extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
    label?: string;
    options: SelectOption[];
    placeholder?: string;
    error?: boolean;
    size?: "sm" | "md";
}

export function SelectField({
    label,
    options,
    placeholder,
    error = false,
    size = "md",
    className = "",
    id,
    ...props
}: SelectFieldProps) {
    const fieldId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const borderColor = error
        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
        : "border-slate-300 focus:border-blue-500 focus:ring-blue-200";

    const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : "px-3 py-2.5 text-base";

    return (
        <div className={`relative ${className}`}>
            {label && (
                <label
                    htmlFor={fieldId}
                    className="absolute -top-2.5 left-2 z-10 bg-white px-1 text-xs text-slate-500"
                >
                    {label}
                </label>
            )}
            <select
                id={fieldId}
                className={`w-full appearance-none rounded border bg-white text-slate-900 focus:outline-none focus:ring-1 transition-colors pr-8 ${borderColor} ${sizeClass}`}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                />
            </svg>
        </div>
    );
}
