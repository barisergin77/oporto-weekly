import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listEventMonths, monthFromSlugPT, ptSlug } from '@/lib/event-months';
import { MonthHub, monthHubMetadata } from '../../../porto-events/MonthHub';

/** /pt/eventos/outubro-2026 — the agenda for a month, in Portuguese. */

export function generateStaticParams() {
  return listEventMonths().map((m) => ({ mes: ptSlug(m) }));
}
export const dynamicParams = false;

const find = (slug: string) => {
  const m = monthFromSlugPT(slug);
  return m && listEventMonths().some((x) => x.slug === m.slug) ? m : null;
};

export async function generateMetadata({ params }: { params: { mes: string } }): Promise<Metadata> {
  const m = find(params.mes);
  return m ? monthHubMetadata(m, 'pt') : { title: 'Não encontrado' };
}

export default function MesPage({ params }: { params: { mes: string } }) {
  const m = find(params.mes);
  if (!m) notFound();
  return <MonthHub m={m} lang="pt" />;
}
