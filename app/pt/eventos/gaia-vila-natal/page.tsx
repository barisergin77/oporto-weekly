import type { Metadata } from 'next';
import { GaiaVilaNatal, gaiaVilaNatalMetadata } from '@/app/porto-events/GaiaVilaNatal';

/** /pt/eventos/gaia-vila-natal: Gaia Vila Natal 2026 (G12). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return gaiaVilaNatalMetadata('pt');
}

export default function GaiaVilaNatalPtPage() {
  return <GaiaVilaNatal lang="pt" />;
}
