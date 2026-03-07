import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline";
    size?: "sm" | "md" | "lg";
}

export function Button({
    variant = "primary",
    size = "md",
    className = "",
    children,
    ...props
}: ButtonProps) {
    const base =
        "inline-flex items-center justify-center font-semibold uppercase tracking-wider rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants: Record<string, string> = {
        primary:
            "bg-slate-400 text-white hover:bg-slate-500 focus:ring-slate-400",
        secondary:
            "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-300",
        outline:
            "bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 focus:ring-blue-300",
    };

    const sizes: Record<string, string> = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-6 py-2.5 text-sm",
        lg: "px-8 py-3 text-base",
    };

    return (
        <button
            className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
