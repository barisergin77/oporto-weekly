import type { Metadata } from 'next';
import { PlayPage, playMetadata } from './PlayPage';

/** /play: Porto Zoom, the daily Porto guessing game. PT twin at /pt/jogar. ISR rolls the puzzle over at Lisbon midnight. */

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return playMetadata('en');
}

export default function Play() {
  return <PlayPage lang="en" />;
}
