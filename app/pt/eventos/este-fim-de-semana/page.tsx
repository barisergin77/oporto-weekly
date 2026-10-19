import type { Metadata } from 'next';
import { DayHub, dayHubMetadata } from '../../../porto-events/DayHub';

/** /pt/eventos/este-fim-de-semana — o que fazer no Porto este fim de semana. ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return dayHubMetadata('weekend', 'pt');
}

export default function FimDeSemanaPage() {
  return <DayHub kind="weekend" lang="pt" />;
}
