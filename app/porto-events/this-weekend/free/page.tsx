import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../../LandingHub';

/** /porto-events/this-weekend/free — PT twin at /pt/eventos/este-fim-de-semana/gratis. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('weekend-free', 'en');
}

export default function FreeThisWeekendPage() {
  return <LandingHub kind="weekend-free" lang="en" />;
}
