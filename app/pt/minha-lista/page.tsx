import { MyListPage, myListMetadata } from '@/lib/my-list-page';

/** /pt/minha-lista — eventos guardados (owner 2026-11-07). EN twin: /my-list. */
export const revalidate = 3600;
export const metadata = myListMetadata('pt');
export default function Page() {
  return <MyListPage lang="pt" />;
}
