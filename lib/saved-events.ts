'use client';

/**
 * "My list" (owner 2026-11-07): event slugs a visitor saved, kept in this
 * browser only (no accounts). Every read/write is guarded: storage can be
 * blocked (private mode, previews) and the site must work without it.
 * Components stay in sync through a window event.
 */

import { useEffect, useState } from 'react';

const KEY = 'ow:saved-events';
const EVT = 'ow:saved-events-changed';

export function readSaved(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function writeSaved(slugs: string[]) {
  const uniq = Array.from(new Set(slugs));
  try { window.localStorage.setItem(KEY, JSON.stringify(uniq)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVT));
}

export function toggleSaved(slug: string): boolean {
  const cur = readSaved();
  const on = !cur.includes(slug);
  writeSaved(on ? [...cur, slug] : cur.filter((s) => s !== slug));
  return on;
}

/** Saved slugs, [] until mounted (avoids a hydration mismatch). */
export function useSaved(): string[] {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSaved(readSaved());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return saved;
}
