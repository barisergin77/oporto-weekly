import Link from 'next/link';
import type { Metadata } from 'next';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { CREDITS_PATH, GAME_NAME, PLAY_PATH, PUZZLES, dayNumber, lisbonDate, placeName, type Lang, type Puzzle } from '@/lib/play';

/**
 * Photo credits for Porto Zoom, /play/credits and /pt/jogar/creditos. Every
 * photo is from Wikimedia Commons under CC BY / CC BY-SA or in the public
 * domain. Puzzles already played show the place and a thumbnail; today's and
 * upcoming ones only show the credit, so the page is not a cheat sheet.
 */

const SITE = 'https://oportoweekly.com';

const COPY = {
  en: {
    title: `${GAME_NAME} photo credits`,
    description: `Authors and licences of the Wikimedia Commons photos used in ${GAME_NAME}, the daily Porto guessing game.`,
    intro: `Every photo in ${GAME_NAME} comes from Wikimedia Commons and is used under the licence shown, or is in the public domain. We resized the files to 1200px and the game shows them cropped and zoomed. Thank you to the photographers.`,
    past: 'Already played',
    upcoming: 'Today and upcoming puzzles',
    upcomingNote: 'Place names are hidden until the puzzle has been played.',
    hidden: (n: number) => `Upcoming photo ${n}`,
    file: 'File page',
    back: `Back to ${GAME_NAME}`,
  },
  pt: {
    title: `Créditos das fotos do ${GAME_NAME}`,
    description: `Autores e licenças das fotos da Wikimedia Commons usadas no ${GAME_NAME}, o jogo diário do Porto.`,
    intro: `Todas as fotos do ${GAME_NAME} vêm da Wikimedia Commons e são usadas com a licença indicada, ou estão no domínio público. Os ficheiros foram reduzidos para 1200px e o jogo mostra-os recortados e ampliados. Obrigado aos fotógrafos.`,
    past: 'Já jogados',
    upcoming: 'Desafio de hoje e próximos',
    upcomingNote: 'O nome do local só aparece depois de o desafio ter sido jogado.',
    hidden: (n: number) => `Foto futura ${n}`,
    file: 'Página do ficheiro',
    back: `Voltar ao ${GAME_NAME}`,
  },
} as const;

export function creditsMetadata(lang: Lang): Metadata {
  const t = COPY[lang];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `${SITE}${CREDITS_PATH[lang]}`,
      languages: { en: `${SITE}${CREDITS_PATH.en}`, 'pt-PT': `${SITE}${CREDITS_PATH.pt}` },
    },
  };
}

function Licence({ p }: { p: Puzzle }) {
  return p.credit.licenceUrl
    ? <a href={p.credit.licenceUrl} target="_blank" rel="noopener noreferrer license" style={{ color: colors.textSoft }}>{p.credit.licence}</a>
    : <>{p.credit.licence}</>;
}

export function CreditsPage({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const today = dayNumber(lisbonDate());
  // Puzzle i (0-based) is first played on day i + 1.
  const played = PUZZLES.filter((_, i) => i + 1 < today);
  const upcoming = PUZZLES.filter((_, i) => i + 1 >= today)
    .sort((a, b) => a.credit.author.localeCompare(b.credit.author) || a.id.localeCompare(b.id));

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang={lang} active="play" />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 48px' }}>
        <h1 style={{ fontFamily: typography.serif, fontSize: 30, color: colors.heading, margin: '0 0 12px' }}>{t.title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: colors.textSoft, margin: '0 0 28px' }}>{t.intro}</p>

        {played.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading }}>{t.past}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {played.map((p) => (
                <li key={p.id} className="credit-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.divider}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={placeName(p, lang)} width={96} height={64} loading="lazy" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600, color: colors.heading }}>{placeName(p, lang)}</div>
                    <div style={{ color: colors.textSoft }}>
                      {p.credit.author}, <Licence p={p} />, <a href={p.credit.page} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSoft }}>{t.file}</a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 style={{ fontFamily: typography.serif, fontSize: 20, color: colors.heading, marginBottom: 4 }}>{t.upcoming}</h2>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 8px' }}>{t.upcomingNote}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {upcoming.map((p, i) => (
              <li key={p.id} style={{ padding: '8px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 14, color: colors.textSoft }}>
                <span style={{ color: colors.heading }}>{t.hidden(i + 1)}</span>: {p.credit.author}, <Licence p={p} />,{' '}
                <a href={p.credit.page} target="_blank" rel="noopener noreferrer" style={{ color: colors.textSoft }}>{t.file}</a>
              </li>
            ))}
          </ul>
        </section>

        <p style={{ marginTop: 28, fontSize: 14 }}>
          <Link href={PLAY_PATH[lang]} style={{ color: colors.heading }}>← {t.back}</Link>
        </p>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
