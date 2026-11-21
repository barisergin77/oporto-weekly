import type { Metadata } from 'next';
import { ChristmasLights, christmasLightsMetadata } from '../../../porto-events/ChristmasLights';

/** /pt/eventos/luzes-de-natal: inauguração das luzes de Natal do Porto (G1). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return christmasLightsMetadata('pt');
}

export default function LuzesDeNatalPage() {
  return <ChristmasLights lang="pt" />;
}
