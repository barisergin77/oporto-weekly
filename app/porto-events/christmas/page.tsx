import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../LandingHub';

/** /porto-events/christmas: Christmas + New Year's Eve (#40). PT twin at /pt/eventos/natal. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('christmas', 'en');
}

export default function ChristmasEventsPage() {
  return <LandingHub kind="christmas" lang="en" />;
}
