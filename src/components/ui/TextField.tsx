import React from "react";

export interface TextFieldProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    label?: string;
    helperText?: string;
    error?: boolean;
    size?: "sm" | "md";
}

export function TextField({
    label,
    helperText,
    error = false,
    size = "md",
    className = "",
    id,
    ...props
}: TextFieldProps) {
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
                    className="absolute -top-2.5 left-2 bg-white px-1 text-xs text-slate-500"
                >
                    {label}
                </label>
            )}
            <input
                id={fieldId}
                className={`w-full rounded border bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${borderColor} ${sizeClass}`}
                {...props}
            />
            {helperText && (
                <p
                    className={`mt-1 text-xs ${error ? "text-red-500" : "text-slate-400"}`}
                >
                    {helperText}
                </p>
            )}
        </div>
    );
}
