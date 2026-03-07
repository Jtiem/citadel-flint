import React from "react";

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    as?: 1 | 2 | 3 | 4 | 5 | 6;
}

const sizeMap: Record<number, string> = {
    1: "text-2xl",
    2: "text-xl",
    3: "text-lg",
    4: "text-base",
    5: "text-sm",
    6: "text-xs",
};

export function Heading({ as = 1, className = "", children, ...props }: HeadingProps) {
    const Component = `h${as}` as React.ElementType;
    return (
        <Component
            className={`font-medium tracking-tight text-slate-800 ${sizeMap[as]} ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}
