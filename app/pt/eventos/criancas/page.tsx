import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../../../porto-events/LandingHub';

/** /pt/eventos/criancas — eventos para crianças e famílias. ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('kids', 'pt');
}

export default function CriancasPage() {
  return <LandingHub kind="kids" lang="pt" />;
}
