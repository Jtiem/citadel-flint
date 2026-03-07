import React from "react";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
    direction?: "horizontal" | "vertical";
    spacing?: number;
}

export function Stack({ direction = "vertical", spacing = 4, className = "", children, ...props }: StackProps) {
    const dirClass = direction === "horizontal" ? "flex-row" : "flex-col";
    // Simplified dynamic spacing handling for mock purposes
    const spacingClass = `gap-${spacing}`;

    return (
        <div className={`flex ${dirClass} ${spacingClass} ${className} `} {...props}>
            {children}
        </div>
    );
}
