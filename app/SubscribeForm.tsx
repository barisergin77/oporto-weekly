'use client';

import { useState } from 'react';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setMessage("You're in! Check your inbox for a welcome email.");
        setEmail('');
      } else {
        throw new Error(data.error || 'Something went wrong');
      }
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  }

  const gold = '#c9a96e';
  const bg = '#1a1a2e';

  return (
    <>
      {status === 'success' ? (
        <div style={{
          color: gold,
          fontSize: '0.9rem',
          padding: '12px 14px',
          background: `${gold}15`,
          borderRadius: 8,
          border: `1px solid ${gold}44`,
          lineHeight: 1.5,
          textAlign: 'center',
        }}>
          ✅ {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === 'loading'}
            style={{
              padding: '11px 14px',
              fontSize: '0.9rem',
              borderRadius: 8,
              border: `1px solid ${gold}55`,
              background: '#0f0e17',
              color: '#fff',
              outline: 'none',
              fontFamily: 'inherit',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              padding: '11px',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: gold,
              color: bg,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.2s',
              letterSpacing: '0.3px',
            }}
          >
            {status === 'loading' ? 'Subscribing…' : 'Subscribe Free →'}
          </button>
          {status === 'error' && (
            <p style={{ color: '#ff6b6b', margin: 0, fontSize: '0.82rem' }}>⚠️ {message}</p>
          )}
          <p style={{ color: '#8892b0', fontSize: '0.72rem', margin: 0, textAlign: 'center' }}>
            Free · No spam · Unsubscribe anytime
          </p>
        </form>
      )}
    </>
  );
}
