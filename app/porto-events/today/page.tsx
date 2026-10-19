import type { Metadata } from 'next';
import { DayHub, dayHubMetadata } from '../DayHub';

/** /porto-events/today — PT twin at /pt/eventos/hoje. Hourly ISR keeps the date current. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return dayHubMetadata('today', 'en');
}

export default function TodayPage() {
  return <DayHub kind="today" lang="en" />;
}
