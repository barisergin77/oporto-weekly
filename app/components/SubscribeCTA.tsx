'use client';

import { useState } from 'react';

export default function SubscribeCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const gold = '#c9a96e';
  const cardBg = '#16213e';

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

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${gold}33`,
      borderRadius: 12,
      padding: '2rem',
      textAlign: 'center',
      marginTop: '3rem',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🦁</div>
      <h3 style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
        Enjoying this?
      </h3>
      <p style={{ color: '#8892b0', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
        Get Oporto Weekly every Thursday — the best of Porto, curated.
      </p>
      {status === 'success' ? (
        <p style={{ color: gold, fontWeight: 600 }}>{message}</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              border: `1px solid ${gold}55`,
              background: '#1a1a2e',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
              minWidth: 220,
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              border: 'none',
              background: gold,
              color: '#1a1a2e',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' ? 0.7 : 1,
            }}
          >
            {status === 'loading' ? 'Subscribing…' : 'Subscribe →'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p style={{ color: '#ff6b6b', marginTop: '0.75rem', fontSize: '0.9rem' }}>{message}</p>
      )}
    </div>
  );
}
