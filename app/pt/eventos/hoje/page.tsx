import type { Metadata } from 'next';
import { DayHub, dayHubMetadata } from '../../../porto-events/DayHub';

/** /pt/eventos/hoje — o que fazer no Porto hoje. ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return dayHubMetadata('today', 'pt');
}

export default function HojePage() {
  return <DayHub kind="today" lang="pt" />;
}
