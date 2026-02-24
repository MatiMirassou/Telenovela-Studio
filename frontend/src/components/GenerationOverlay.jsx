import { useState, useEffect } from 'react';
import { useGeneration } from '../context/GenerationContext';

export default function GenerationOverlay() {
  const { isGenerating, actionLabel, startTime } = useGeneration();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating || !startTime) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick(); // immediate first tick
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isGenerating, startTime]);

  if (!isGenerating) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '3rem 4rem',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: 420,
        width: '90%',
      }}>
        {/* Spinner */}
        <div style={{
          width: 56,
          height: 56,
          border: '4px solid #e2e8f0',
          borderTopColor: '#f28c28',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem',
        }} />

        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1e293b',
          margin: '0 0 0.5rem',
        }}>
          {actionLabel || 'Generating...'}
        </h2>

        <p style={{
          fontSize: '0.9rem',
          color: '#64748b',
          margin: '0 0 1.5rem',
        }}>
          Please wait while this completes. Do not navigate away.
        </p>

        {/* Timer */}
        <div style={{
          fontSize: '2rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          color: '#f28c28',
          letterSpacing: 2,
        }}>
          {timeStr}
        </div>
      </div>
    </div>
  );
}
