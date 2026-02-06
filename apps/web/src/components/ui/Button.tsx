import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {

        const baseStyles = `
            inline-flex items-center justify-center font-semibold 
            transition-all duration-200 ease-out
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            active:scale-[0.96]
        `;

        const variants = {
            primary: `
                bg-primary hover:bg-primary-hover text-white
                shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30
                border border-transparent
                rounded-xl
            `,
            gradient: `
                bg-gradient-to-r from-primary to-primary-700 text-white 
                shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35
                hover:from-primary-600 hover:to-primary-800
                rounded-[14px]
            `,
            secondary: `
                bg-secondary text-white hover:bg-sidebar
                shadow-md hover:shadow-lg
                rounded-[14px]
            `,
            outline: `
                border border-border text-text-main bg-white hover:bg-surface-highlight hover:border-primary/20
                shadow-sm hover:shadow-md transition-all
                rounded-xl
            `,
            ghost: `
                text-text-muted hover:bg-surface-highlight hover:text-text-main
                rounded-[10px]
            `,
            danger: `
                bg-danger text-white hover:bg-red-600 
                shadow-lg shadow-danger/20 hover:shadow-xl hover:shadow-danger/30
                rounded-[14px]
            `,
        };

        const sizes = {
            sm: 'px-3.5 py-2 text-xs gap-1.5',
            md: 'px-5 py-2.5 text-sm gap-2',
            lg: 'px-7 py-3.5 text-base gap-2.5',
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
