'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary component that catches JavaScript errors anywhere in 
 * the child component tree, logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({ errorInfo });

        // In production, you could send this to an error tracking service
        // e.g., Sentry, LogRocket, etc.
        if (process.env.NODE_ENV === 'production') {
            // reportErrorToService(error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-surface rounded-2xl shadow-lg border border-border p-8 text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rose-100 flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-rose-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        {/* Error Message */}
                        <h2 className="text-xl font-bold text-text-main mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-text-muted mb-6">
                            We&apos;re sorry, but something unexpected happened. You can try again or reload the page.
                        </p>

                        {/* Error Details (Development Only) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="cursor-pointer text-sm text-text-muted hover:text-text-main">
                                    Error Details
                                </summary>
                                <pre className="mt-2 p-3 bg-background rounded-lg text-xs overflow-auto max-h-40 text-rose-600">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo && (
                                        <>
                                            {'\n\nComponent Stack:\n'}
                                            {this.state.errorInfo.componentStack}
                                        </>
                                    )}
                                </pre>
                            </details>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-6 py-2.5 bg-background text-text-main font-medium rounded-lg border border-border hover:bg-surface transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-friendly wrapper for error boundary functionality.
 * Use this to wrap specific components that might throw errors.
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
