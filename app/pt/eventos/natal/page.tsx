import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../../../porto-events/LandingHub';

/** /pt/eventos/natal: Natal e Passagem de Ano (#40). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('christmas', 'pt');
}

export default function NatalPage() {
  return <LandingHub kind="christmas" lang="pt" />;
}
