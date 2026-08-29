import Link from 'next/link';
import { colors, typography } from '@/lib/design';

const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle' }}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

interface FooterProps {
  lang?: 'en' | 'pt';
}

const linkStyle = { color: colors.heading, textDecoration: 'none' as const, fontSize: 12, borderBottom: `1px solid ${colors.accent}`, paddingBottom: 1 };
const plainLink = { color: colors.textSoft, textDecoration: 'none' as const, fontSize: 12 };
const sep = <span style={{ color: colors.textMuted, margin: '0 6px' }}>·</span>;

export function Footer({ lang = 'en' }: FooterProps) {
  const isEN = lang === 'en';

  return (
    <footer style={{
      background: colors.bgAlt,
      padding: '36px 28px',
      textAlign: 'center',
      borderTop: `1px solid ${colors.divider}`,
    }}>
      {/* Logo */}
      <Link href={isEN ? '/' : '/pt'} style={{
        fontFamily: typography.serif,
        fontSize: 20,
        color: colors.heading,
        textDecoration: 'none',
        letterSpacing: 0.3,
      }}>
        Oporto Weekly
      </Link>

      {/* Gold divider */}
      <div style={{ width: 40, height: 2, background: colors.accent, margin: '12px auto 16px' }} />

      {/* Tagline */}
      <div style={{ fontSize: 13, color: colors.textSoft, marginBottom: 10 }}>
        {isEN ? 'Curated every Thursday · Porto, Portugal' : 'Curado todas as quintas-feiras · Porto, Portugal'}
      </div>

      {/* Nav links */}
      <div className="footer-links" style={{ fontSize: 12, lineHeight: 2 }}>
        <Link href={isEN ? '/blog' : '/pt/blog'} style={linkStyle}>Blog</Link>
        {sep}
        <Link href={isEN ? '/archive' : '/pt/arquivo'} style={linkStyle}>
          {isEN ? 'Archive' : 'Arquivo'}
        </Link>
        {sep}
        <Link href={isEN ? '/pt' : '/'} style={plainLink}>
          {isEN ? 'Português' : 'English'}
        </Link>
        {sep}
        <a href="mailto:hello@oportoweekly.com" style={plainLink}>
          hello@oportoweekly.com
        </a>
        {sep}
        <a
          href="https://www.instagram.com/oportoweekly/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...plainLink, verticalAlign: 'middle' }}
          aria-label="Instagram"
        >
          <InstagramIcon />
        </a>
      </div>

      {/* Copyright */}
      <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 20, marginBottom: 0 }}>
        © {new Date().getFullYear()} Oporto Weekly · {isEN ? 'Made with ♡ in Porto' : 'Feito com ♡ no Porto'}
      </p>
    </footer>
  );
}
