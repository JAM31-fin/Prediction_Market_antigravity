import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Centra Markets [Uncaught Component Error]:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[500px] flex items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-lg w-full p-6 rounded-2xl bg-slate-900 border border-rose-500/30 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
              {this.props.fallbackTitle || 'A component error occurred'}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
              The application encountered an unexpected runtime exception while rendering this view.
              Your account and market balances remain intact.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-rose-300 font-mono text-xs overflow-x-auto">
                <div className="font-bold text-rose-400">Error:</div>
                <div className="mt-0.5">{this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2 text-slate-500 text-[10px]">
                    <summary className="cursor-pointer hover:text-slate-400 font-sans">Component Stack</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-xs">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
