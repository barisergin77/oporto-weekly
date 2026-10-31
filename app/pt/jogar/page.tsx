import type { Metadata } from 'next';
import { PlayPage, playMetadata } from '../../play/PlayPage';

/** /pt/jogar: Porto Zoom em português. EN em /play. */

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return playMetadata('pt');
}

export default function Jogar() {
  return <PlayPage lang="pt" />;
}
