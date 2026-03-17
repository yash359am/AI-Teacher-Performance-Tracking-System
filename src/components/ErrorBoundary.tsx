import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
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

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore ${parsed.operationType} error: ${parsed.error}`;
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle size={32} />
              <h2 className="text-2xl font-black tracking-tighter uppercase italic">System Error</h2>
            </div>
            <p className="text-sm font-mono mb-6 bg-red-50 p-4 border border-red-200 text-red-800 break-words">
              {errorMessage}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 px-6 hover:bg-gray-800 transition-colors font-bold uppercase tracking-tight"
            >
              <RefreshCcw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
