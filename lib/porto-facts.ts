/**
 * "Porto facts" box (owner 2026-10-31): short, sourced facts about Porto in
 * EN and PT-PT, data/porto-facts.json. Every fact carries the URL it was
 * checked against; drop a fact rather than ship one without a source.
 * Copy rules: lib/humanizer.ts (npm run test:humanizer checks every string).
 *
 * The server picks the day's fact (same for everyone on a Lisbon date, so the
 * box renders without a layout jump); the client only changes it on click.
 */

import factsJson from '@/data/porto-facts.json';
import { dayNumber } from './play';

export interface PortoFact {
  id: string;
  en: string;
  pt: string;
  sourceUrl: string;
}

export const PORTO_FACTS: PortoFact[] = factsJson as PortoFact[];

/** Index of the fact for a Lisbon date (YYYY-MM-DD), stepping through the list with a stride so neighbours differ. */
export function factIndexForDate(iso: string, count = PORTO_FACTS.length): number {
  if (count <= 0) return 0;
  const stride = 7; // coprime with any count not divisible by 7
  const step = count % stride === 0 ? 1 : stride;
  return (((dayNumber(iso) - 1) * step) % count + count) % count;
}
