import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Last line of defence against a white screen.
 *
 * React unmounts the whole tree when a render throws, which is how a single bad
 * component turns into a blank page with nothing but a console message. This
 * catches that and shows something a human can act on instead.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept as console output on purpose: there is no error-reporting backend
    // wired up, and swallowing this silently is what made the original bug so
    // hard to pin down.
    console.error('[HAVAN] render crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#07090e',
          color: '#fff',
        }}
      >
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <AlertTriangle size={40} strokeWidth={1.5} style={{ color: '#f5a524' }} aria-hidden="true" />
          <h1 style={{ fontSize: '1.5rem', margin: '16px 0 8px' }}>Scene thoda bigad gaya</h1>
          <p style={{ opacity: 0.7, lineHeight: 1.6, margin: '0 0 20px' }}>
            Something broke while drawing this page. Reloading usually sorts it out.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            <RotateCw size={16} aria-hidden="true" />
            Reload
          </button>
          <pre
            style={{
              marginTop: 24,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.75rem',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {String(error?.message || error)}
          </pre>
        </div>
      </div>
    );
  }
}
