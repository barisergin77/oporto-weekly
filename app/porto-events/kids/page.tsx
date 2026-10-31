import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../LandingHub';

/** /porto-events/kids — PT twin at /pt/eventos/criancas. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('kids', 'en');
}

export default function KidsEventsPage() {
  return <LandingHub kind="kids" lang="en" />;
}
