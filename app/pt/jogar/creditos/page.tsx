import type { Metadata } from 'next';
import { CreditsPage, creditsMetadata } from '../../../play/CreditsPage';

/** /pt/jogar/creditos: créditos das fotos do Porto Zoom. EN em /play/credits. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return creditsMetadata('pt');
}

export default function JogarCreditos() {
  return <CreditsPage lang="pt" />;
}
