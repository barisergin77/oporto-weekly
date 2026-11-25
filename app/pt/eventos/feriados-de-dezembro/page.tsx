import type { Metadata } from 'next';
import { DecemberHolidays, decemberHolidaysMetadata } from '@/app/porto-events/DecemberHolidays';

/** /pt/eventos/feriados-de-dezembro: fins de semana prolongados de 1 e 8 de dezembro no Porto (G10). ISR de hora a hora. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return decemberHolidaysMetadata('pt');
}

export default function FeriadosDeDezembroPage() {
  return <DecemberHolidays lang="pt" />;
}
