import type { Metadata } from 'next';
import { ChristmasConcerts, christmasConcertsMetadata } from '../ChristmasConcerts';

/** /porto-events/christmas-concerts: Christmas concerts in Porto by date (G8). PT twin at /pt/eventos/concertos-de-natal. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasConcertsMetadata('en');
}

export default function ChristmasConcertsPage() {
  return <ChristmasConcerts lang="en" />;
}
