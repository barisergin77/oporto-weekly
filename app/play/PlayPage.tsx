import Link from 'next/link';
import type { Metadata } from 'next';
import { colors, typography } from '@/lib/design';
import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import { SubscribeCTA } from '@/app/components/SubscribeCTA';
import { PortoFactsBox } from '@/app/components/PortoFactsBox';
import { blogDisplay, hasBlogPT, listBlogPosts } from '@/lib/blog';
import { guideForTopic } from '@/lib/related-guides';
import { humanizeText } from '@/lib/humanizer';
import {
  CREDITS_PATH, GAME_NAME, PLAY_PATH, choicesFor, placeList, lisbonDate, puzzleForDate, type Lang,
} from '@/lib/play';
import { PlayGame } from './PlayGame';

/**
 * Porto Zoom page, shared by /play (EN) and /pt/jogar (PT). The route files
 * set `revalidate` so the puzzle changes at Lisbon midnight without a deploy;
 * the client also notices a new day and offers a reload.
 */

const SITE = 'https://oportoweekly.com';

const COPY = {
  en: {
    title: `${GAME_NAME}: the daily Porto guessing game`,
    description: 'Guess the Porto street or landmark from a close-up photo. Every wrong guess zooms out. A new puzzle every day, free.',
    h1: GAME_NAME,
    eyebrow: 'Daily Porto game',
    credits: 'Photo credits',
  },
  pt: {
    title: `${GAME_NAME}: o jogo diário do Porto`,
    description: 'Adivinhe a rua ou o monumento do Porto a partir de uma foto muito de perto. Cada erro afasta a imagem. Um desafio novo todos os dias.',
    h1: GAME_NAME,
    eyebrow: 'Jogo diário do Porto',
    credits: 'Créditos das fotos',
  },
} as const;

export function playMetadata(lang: Lang): Metadata {
  const t = COPY[lang];
  const url = `${SITE}${PLAY_PATH[lang]}`;
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: url,
      languages: { en: `${SITE}${PLAY_PATH.en}`, 'pt-PT': `${SITE}${PLAY_PATH.pt}`, 'x-default': `${SITE}${PLAY_PATH.en}` },
    },
    openGraph: { title: t.title, description: t.description, url, type: 'website', ...(lang === 'pt' ? { locale: 'pt_PT' } : {}) },
    twitter: { card: 'summary_large_image', title: t.title, description: t.description },
  };
}

/** Newest guide for the puzzle's topic; PT links /pt/blog only when the guide has a PT version. */
function guideLink(topic: string, lang: Lang) {
  const post = guideForTopic(topic, listBlogPosts());
  if (!post) return undefined;
  const pt = lang === 'pt' && hasBlogPT(post.slug);
  return {
    href: pt ? `/pt/blog/${post.slug}` : `/blog/${post.slug}`,
    title: humanizeText(blogDisplay(post, pt ? 'pt' : 'en').title, { title: true }),
  };
}

export function PlayPage({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const date = lisbonDate();
  const { puzzle, number } = puzzleForDate(date);

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', fontFamily: typography.sans, color: colors.text }}>
      <Header lang={lang} active="play" />

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 48px' }}>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent, fontWeight: 700, marginBottom: 6 }}>
          {t.eyebrow} · #{number}
        </div>
        <h1 style={{ fontFamily: typography.serif, fontSize: 34, color: colors.heading, margin: '0 0 12px', letterSpacing: -0.5 }}>
          {t.h1}
        </h1>

        <PlayGame
          lang={lang}
          date={date}
          number={number}
          puzzle={puzzle}
          places={placeList()}
          choices={choicesFor(number)}
          guide={guideLink(puzzle.guide, lang)}
        >
          <SubscribeCTA lang={lang} context="play" />
        </PlayGame>

        <div style={{ marginTop: 36 }}>
          <PortoFactsBox lang={lang} />
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 12 }}>
          <Link href={CREDITS_PATH[lang]} style={{ color: colors.textSoft }}>{t.credits}</Link>
        </p>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
