import React from 'react';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
    className?: string;
}

export function Progress({ value = 0, max = 100, className = '', ...props }: ProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div
            className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}
            {...props}
        >
            <div
                className="h-full bg-blue-600 transition-all duration-500 ease-in-out dark:bg-blue-500"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
