import type { Metadata } from 'next';
import { ChristmasKids, christmasKidsMetadata } from '@/app/porto-events/ChristmasKids';

/** /pt/eventos/natal-com-criancas: o que fazer com crianças no Natal no Porto (G11). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasKidsMetadata('pt');
}

export default function NatalComCriancasPage() {
  return <ChristmasKids lang="pt" />;
}
