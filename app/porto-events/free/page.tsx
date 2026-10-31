import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../LandingHub';

/** /porto-events/free — PT twin at /pt/eventos/gratis. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('free', 'en');
}

export default function FreeEventsPage() {
  return <LandingHub kind="free" lang="en" />;
}
