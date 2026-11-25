import type { Metadata } from 'next';
import { DecemberHolidays, decemberHolidaysMetadata } from '../DecemberHolidays';

/** /porto-events/december-long-weekends: 1 + 8 Dec long weekends in Porto (G10). PT twin at /pt/eventos/feriados-de-dezembro. Hourly ISR. */

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return decemberHolidaysMetadata('en');
}

export default function DecemberLongWeekendsPage() {
  return <DecemberHolidays lang="en" />;
}
