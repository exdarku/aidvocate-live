import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable fallback
 * instead of unmounting the whole app to a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this is where you'd report to Sentry/CloudWatch.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
          background: '#1C1D28',
          color: '#FEFFF6',
        }}
      >
        <h1 style={{ margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.8, maxWidth: 420 }}>
          An unexpected error occurred. Reloading the page usually fixes it.
        </p>
        <button
          onClick={() => window.location.assign('/')}
          style={{
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            background: '#FCD384',
            color: '#1C1D28',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go home
        </button>
      </div>
    );
  }
}
