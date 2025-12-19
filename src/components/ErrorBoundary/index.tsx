import React, { Component, ErrorInfo, ReactNode, Suspense } from "react";
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Props interface for ErrorBoundary
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: "page" | "section" | "component";
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

// Main ErrorBoundary class component
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name || 'unnamed'}] caught an error:`, error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log to analytics/monitoring service in production
    if (import.meta.env.PROD) {
      // Could send to Sentry, LogRocket, etc.
      console.error("Production error:", {
        name: this.props.name,
        level: this.props.level,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback, level = "section", name } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback;
    }

    // Different UI based on error level
    if (level === "component") {
      return (
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <span>Failed to load {name || "component"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="ml-auto h-7 px-2"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      );
    }

    if (level === "section") {
      return (
        <div className="p-6 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                {name ? `${name} failed to load` : "Something went wrong"}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                This section encountered an error. Try refreshing or come back later.
              </p>
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={this.handleRetry} className="gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </Button>
                {import.meta.env.DEV && error && (
                  <Button variant="ghost" size="sm" onClick={this.toggleDetails} className="gap-1">
                    <Bug className="w-3 h-3" />
                    {showDetails ? "Hide" : "Show"} Details
                    <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>
              {showDetails && error && (
                <div className="mt-3 p-3 bg-secondary/50 rounded text-xs font-mono overflow-auto max-h-40">
                  <p className="text-destructive font-semibold">{error.name}: {error.message}</p>
                  {error.stack && (
                    <pre className="mt-2 text-muted-foreground whitespace-pre-wrap">{error.stack}</pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Page level - full page error
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="inline-flex p-4 rounded-full bg-destructive/10 mb-6">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Something went wrong
          </h2>
          
          <p className="text-muted-foreground mb-6">
            We encountered an unexpected error. This has been logged and we'll look into it.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-secondary/50 rounded-lg text-left">
              <p className="text-xs text-muted-foreground font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <Button onClick={this.handleRetry} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>

          {import.meta.env.DEV && errorInfo && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Developer Details
              </summary>
              <pre className="mt-2 p-3 bg-secondary/50 rounded text-xs overflow-auto max-h-60 font-mono">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

// Loading fallback components
export const PageLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export const SectionLoadingFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const ComponentLoadingFallback = () => (
  <Skeleton className="h-24 w-full rounded-lg" />
);

// Wrapper components for different error boundary levels
export const PageErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundaryClass level="page" name={name}>
    <Suspense fallback={<PageLoadingFallback />}>
      {children}
    </Suspense>
  </ErrorBoundaryClass>
);

export const SectionErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundaryClass level="section" name={name}>
    <Suspense fallback={<SectionLoadingFallback />}>
      {children}
    </Suspense>
  </ErrorBoundaryClass>
);

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; name?: string }> = ({ children, name }) => (
  <ErrorBoundaryClass level="component" name={name}>
    <Suspense fallback={<ComponentLoadingFallback />}>
      {children}
    </Suspense>
  </ErrorBoundaryClass>
);

// Export the class as default for backward compatibility
export default ErrorBoundaryClass;
