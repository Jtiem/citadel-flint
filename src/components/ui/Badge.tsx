import React from "react";

export interface BadgeProps {
    variant?: "default" | "success" | "warning" | "error" | "info" | "neutral";
    size?: "sm" | "md";
    children: React.ReactNode;
    className?: string;
}

const variantClasses: Record<string, string> = {
    neutral: "bg-zinc-700 text-zinc-300 border border-zinc-600",
    success: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50",
    warning: "bg-amber-900/40 text-amber-400 border border-amber-700/50",
    error: "bg-red-900/40 text-red-400 border border-red-700/50",
    info: "bg-blue-900/40 text-blue-400 border border-blue-700/50",
    default: "bg-zinc-800 text-zinc-400 border border-zinc-700",
};

const sizeClasses: Record<string, string> = {
    sm: "text-xs px-1.5 py-0.5 rounded",
    md: "text-sm px-2 py-0.5 rounded",
};

export function Badge({
    variant = "neutral",
    size = "sm",
    children,
    className = "",
}: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        >
            {children}
        </span>
    );
}

export default Badge;
