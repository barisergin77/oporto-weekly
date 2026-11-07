'use client';

import Link from 'next/link';
import { useSaved } from '@/lib/saved-events';

/** Header link to "My list" with the saved count (hidden count at 0). */
export function MyListLink({ lang, style }: { lang: 'en' | 'pt'; style: React.CSSProperties }) {
  const n = useSaved().length;
  return (
    <Link href={lang === 'en' ? '/my-list' : '/pt/minha-lista'} style={style}>
      {lang === 'en' ? 'My list' : 'Minha lista'}{n > 0 ? ` ★ ${n}` : ''}
    </Link>
  );
}
