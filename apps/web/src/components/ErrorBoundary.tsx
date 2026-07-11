'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-main)' }}>
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Something went wrong. Please try refreshing the page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                تحديث الصفحة
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="btn-secondary"
              >
                العودة للرئيسية
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-6 p-4 rounded-xl text-xs text-left overflow-auto max-h-40" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)', color: '#ef4444' }}>
                {this.state.error.message}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
