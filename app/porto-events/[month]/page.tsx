import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listEventMonths, monthFromSlug } from '@/lib/event-months';
import { MonthHub, monthHubMetadata } from '../MonthHub';

/** /porto-events/october-2026 — PT twin at /pt/eventos/outubro-2026. */

export function generateStaticParams() {
  return listEventMonths().map((m) => ({ month: m.slug }));
}
export const dynamicParams = false;

const find = (slug: string) => {
  const m = monthFromSlug(slug);
  return m && listEventMonths().some((x) => x.slug === m.slug) ? m : null;
};

export async function generateMetadata({ params }: { params: { month: string } }): Promise<Metadata> {
  const m = find(params.month);
  return m ? monthHubMetadata(m, 'en') : { title: 'Not found' };
}

export default function MonthPage({ params }: { params: { month: string } }) {
  const m = find(params.month);
  if (!m) notFound();
  return <MonthHub m={m} lang="en" />;
}
