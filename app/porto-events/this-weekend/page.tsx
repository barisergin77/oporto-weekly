import type { Metadata } from 'next';
import { DayHub, dayHubMetadata } from '../DayHub';

/** /porto-events/this-weekend — PT twin at /pt/eventos/este-fim-de-semana. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return dayHubMetadata('weekend', 'en');
}

export default function ThisWeekendPage() {
  return <DayHub kind="weekend" lang="en" />;
}
