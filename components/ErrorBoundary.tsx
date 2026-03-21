
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full border border-red-500/50">
            <h2 className="text-2xl font-bold text-red-500 mb-4">¡Ups! Algo salió mal</h2>
            <p className="text-gray-300 mb-6">
              Ha ocurrido un error inesperado en la aplicación. Por favor, intenta recargar la página.
            </p>
            <div className="bg-black/50 p-4 rounded font-mono text-xs text-red-400 overflow-auto max-h-40 mb-6">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-semibold"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
