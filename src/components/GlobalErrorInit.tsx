'use client';

import { useEffect } from 'react';
import { initGlobalErrorReporting } from './ErrorBoundary';

export default function GlobalErrorInit() {
  useEffect(() => {
    initGlobalErrorReporting();
  }, []);
  return null;
}
