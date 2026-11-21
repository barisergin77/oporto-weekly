import type { Metadata } from 'next';
import { ChristmasLights, christmasLightsMetadata } from '../ChristmasLights';

/** /porto-events/christmas-lights: Porto Christmas lights switch-on (G1). PT twin at /pt/eventos/luzes-de-natal. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasLightsMetadata('en');
}

export default function ChristmasLightsPage() {
  return <ChristmasLights lang="en" />;
}
