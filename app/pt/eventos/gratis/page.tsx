import type { Metadata } from 'next';
import { LandingHub, landingMetadata } from '../../../porto-events/LandingHub';

/** /pt/eventos/gratis — eventos grátis no Porto. ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return landingMetadata('free', 'pt');
}

export default function GratisPage() {
  return <LandingHub kind="free" lang="pt" />;
}
