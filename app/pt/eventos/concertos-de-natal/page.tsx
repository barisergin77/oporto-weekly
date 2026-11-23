import type { Metadata } from 'next';
import { ChristmasConcerts, christmasConcertsMetadata } from '../../../porto-events/ChristmasConcerts';

/** /pt/eventos/concertos-de-natal: concertos de Natal no Porto por data (G8). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasConcertsMetadata('pt');
}

export default function ConcertosDeNatalPage() {
  return <ChristmasConcerts lang="pt" />;
}
