import Link from 'next/link';

const gold = '#c9a96e';
const bg = '#1a1a2e';

const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle' }}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

interface HeaderProps {
  lang?: 'en' | 'pt';
  active?: 'home' | 'blog' | 'archive' | 'events';
}

const linkStyle = (isActive: boolean) => ({
  fontSize: 13,
  color: isActive ? '#fff' : '#9999bb',
  textDecoration: 'none' as const,
  letterSpacing: 0.3,
  fontWeight: isActive ? 600 : 400,
});

export function Header({ lang = 'en', active }: HeaderProps) {
  const isEN = lang === 'en';
  const home = isEN ? '/' : '/pt';
  const archiveHref = isEN ? '/archive' : '/pt/arquivo';
  const archiveLabel = isEN ? 'Newsletter' : 'Newsletter';
  const langHref = isEN ? '/pt' : '/';
  const langLabel = isEN ? 'PT' : 'EN';

  return (
    <header style={{
      background: bg,
      padding: '12px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      {/* Logo */}
      <Link href={home} style={{
        fontFamily: 'Georgia, serif',
        fontSize: 20,
        color: gold,
        textDecoration: 'none',
        letterSpacing: 0.5,
      }}>
        Oporto Weekly
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Link href="/blog" style={linkStyle(active === 'blog')}>
          Blog
        </Link>
        <Link href={archiveHref} style={linkStyle(active === 'archive')}>
          {archiveLabel}
        </Link>

        {/* Separator */}
        <span style={{ color: '#333355', fontSize: 12 }}>|</span>

        {/* Language switcher */}
        <Link href={langHref} style={{
          fontSize: 12,
          color: gold,
          textDecoration: 'none',
          fontWeight: 600,
          letterSpacing: 0.5,
          border: `1px solid ${gold}44`,
          padding: '3px 8px',
          borderRadius: 4,
        }}>
          {langLabel}
        </Link>

        {/* Instagram */}
        <a
          href="https://www.instagram.com/oportoweekly/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9999bb', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
          aria-label="Instagram"
        >
          <InstagramIcon />
        </a>
      </nav>
    </header>
  );
}
