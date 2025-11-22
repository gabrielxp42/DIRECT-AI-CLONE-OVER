import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex items-center justify-center min-h-screen bg-background">
                    <div className="max-w-md w-full p-8 space-y-6 text-center">
                        <div className="flex justify-center">
                            <AlertTriangle className="h-16 w-16 text-destructive" />
                        </div>
                        <h1 className="text-2xl font-bold">Algo deu errado</h1>
                        <p className="text-muted-foreground">
                            Ocorreu um erro inesperado. Por favor, tente novamente.
                        </p>
                        {this.state.error && (
                            <details className="text-left text-sm bg-muted p-4 rounded-md">
                                <summary className="cursor-pointer font-medium mb-2">
                                    Detalhes do erro
                                </summary>
                                <pre className="whitespace-pre-wrap break-words text-xs">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-4 justify-center">
                            <Button onClick={this.handleReset} variant="default">
                                Voltar para o início
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="outline">
                                Recarregar página
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
