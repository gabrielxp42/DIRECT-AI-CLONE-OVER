

import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-red-400 bg-red-900/10 border border-red-500/20 rounded-xl m-4">
                    <h2 className="text-lg font-bold mb-2">Ops! Algo deu errado.</h2>
                    <p className="text-xs text-white/60 mb-4 max-w-md break-words font-mono bg-black/40 p-2 rounded">
                        {this.state.error?.message || 'Erro desconhecido'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg transition-colors text-xs"
                    >
                        Tentar Novamente
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
