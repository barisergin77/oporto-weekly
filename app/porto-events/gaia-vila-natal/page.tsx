import type { Metadata } from 'next';
import { GaiaVilaNatal, gaiaVilaNatalMetadata } from '../GaiaVilaNatal';

/** /porto-events/gaia-vila-natal: Gaia Vila Natal 2026 (G12). PT twin at /pt/eventos/gaia-vila-natal. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return gaiaVilaNatalMetadata('en');
}

export default function GaiaVilaNatalPage() {
  return <GaiaVilaNatal lang="en" />;
}
