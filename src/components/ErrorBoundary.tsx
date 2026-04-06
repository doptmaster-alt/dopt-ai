'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// 전역 에러 수집기
function reportError(data: {
  title: string;
  message: string;
  stackTrace?: string;
  url?: string;
  severity?: string;
  type?: string;
  projectId?: number;
}) {
  try {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        browserInfo: typeof navigator !== 'undefined'
          ? `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`
          : '',
        url: data.url || (typeof window !== 'undefined' ? window.location.href : ''),
      }),
    }).catch(() => {}); // 에러 보고 실패는 무시
  } catch {
    // silent
  }
}

// 전역으로 내보내서 어디서든 사용 가능
export { reportError };

// 전역 window error/unhandledrejection 리스너 초기화
export function initGlobalErrorReporting() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError({
      type: 'runtime',
      severity: 'high',
      title: `Runtime Error: ${event.message}`,
      message: event.message,
      stackTrace: event.error?.stack || '',
      url: event.filename || window.location.href,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason);
    reportError({
      type: 'unhandled_promise',
      severity: 'high',
      title: `Unhandled Promise: ${message.slice(0, 100)}`,
      message: message,
      stackTrace: event.reason?.stack || '',
    });
  });
}

// React Error Boundary
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError({
      type: 'react_boundary',
      severity: 'critical',
      title: `React Error: ${error.message.slice(0, 100)}`,
      message: error.message,
      stackTrace: `${error.stack}\n\nComponent Stack:${errorInfo.componentStack}`,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">
              문제가 자동으로 보고되었습니다. 잠시 후 다시 시도해주세요.
            </p>
            <p className="text-sm text-red-500 mb-4 font-mono bg-red-50 p-2 rounded">
              {this.state.error?.message?.slice(0, 200)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
