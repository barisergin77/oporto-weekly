import type { Metadata } from 'next';
import { ChristmasKids, christmasKidsMetadata } from '../ChristmasKids';

/** /porto-events/christmas-with-kids: Christmas things to do with children in Porto (G11). PT twin at /pt/eventos/natal-com-criancas. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasKidsMetadata('en');
}

export default function ChristmasWithKidsPage() {
  return <ChristmasKids lang="en" />;
}
