import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../../../../porto-events/LandingHub';

/** /pt/eventos/este-fim-de-semana/gratis — o que fazer de graça este fim de semana. ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('weekend-free', 'pt');
}

export default function GratisFimDeSemanaPage() {
  return <LandingHub kind="weekend-free" lang="pt" />;
}
