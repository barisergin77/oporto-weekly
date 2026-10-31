import type { Metadata } from 'next';
import { CreditsPage, creditsMetadata } from '../CreditsPage';

/** /play/credits: Wikimedia Commons credits for the Porto Zoom photos. PT at /pt/jogar/creditos. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return creditsMetadata('en');
}

export default function PlayCredits() {
  return <CreditsPage lang="en" />;
}
