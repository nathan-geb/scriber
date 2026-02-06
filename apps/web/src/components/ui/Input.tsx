import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, icon, ...props }, ref) => {
        return (
            <div className="space-y-2 w-full">
                {label && (
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full p-3.5 rounded-[14px] border border-border bg-surface 
                            font-medium text-text-main 
                            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                            hover:border-border/80
                            transition-all duration-200
                            placeholder:text-text-muted/60
                            shadow-sm
                            ${icon ? 'pl-12' : ''}
                            ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {error && <p className="text-danger text-xs font-medium mt-1">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
