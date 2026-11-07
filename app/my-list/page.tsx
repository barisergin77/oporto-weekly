import { MyListPage, myListMetadata } from '@/lib/my-list-page';

/** /my-list — saved events (owner 2026-11-07). PT twin: /pt/minha-lista. */
export const revalidate = 3600;
export const metadata = myListMetadata('en');
export default function Page() {
  return <MyListPage lang="en" />;
}
