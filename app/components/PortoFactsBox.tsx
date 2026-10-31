import { PORTO_FACTS, factIndexForDate } from '@/lib/porto-facts';
import { lisbonDate } from '@/lib/play';
import { PortoFacts } from './PortoFacts';

/** Server wrapper: today's fact first, the whole list (one language) for the button. */
export function PortoFactsBox({ lang, compact }: { lang: 'en' | 'pt'; compact?: boolean }) {
  const facts = PORTO_FACTS.map((f) => ({ text: lang === 'pt' ? f.pt : f.en, sourceUrl: f.sourceUrl }));
  return <PortoFacts lang={lang} facts={facts} initialIndex={factIndexForDate(lisbonDate())} compact={compact} />;
}
