import React from "react";

export interface IconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: "close" | "info" | "add" | "document";
    size?: "sm" | "md";
    label?: string;
}

const icons: Record<string, React.ReactNode> = {
    close: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    info: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    add: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    ),
    document: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
};

export function IconButton({
    icon,
    size = "md",
    label,
    className = "",
    ...props
}: IconButtonProps) {
    const sizeClass = size === "sm" ? "h-5 w-5 p-0.5" : "h-8 w-8 p-1.5";

    return (
        <button
            type="button"
            aria-label={label || icon}
            className={`inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${sizeClass} ${className}`}
            {...props}
        >
            {icons[icon]}
        </button>
    );
}
