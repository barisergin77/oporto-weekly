import { colors } from '@/lib/design';
import { venueMapsUrl, type VenueProfile } from '@/lib/venue-profiles';

/**
 * Verified venue basics under the venue page's H1 (G9): type, address with a
 * map link, official website. Renders nothing for venues without a profile.
 */
export function VenueInfo({ name, profile, lang }: { name: string; profile?: VenueProfile; lang: 'en' | 'pt' }) {
  if (!profile) return null;
  const pt = lang === 'pt';
  const host = profile.website ? new URL(profile.website).hostname.replace(/^www\./, '') : '';
  const row: React.CSSProperties = { margin: '0 0 6px', fontSize: 15, lineHeight: 1.5 };
  const label: React.CSSProperties = { color: colors.textSoft, fontWeight: 600, marginRight: 6 };
  const link: React.CSSProperties = { color: colors.heading, fontWeight: 600 };
  return (
    <section
      aria-label={pt ? `Informação sobre ${name}` : `About ${name}`}
      style={{ border: `1px solid ${colors.divider}`, borderLeft: `4px solid ${colors.accent}`, borderRadius: 6, padding: '16px 20px', margin: '0 0 40px' }}
    >
      <p style={row}>
        <span style={label}>{pt ? 'Tipo:' : 'Type:'}</span>
        {pt ? profile.type.pt : profile.type.en}
      </p>
      <p style={row}>
        <span style={label}>{pt ? 'Morada:' : 'Address:'}</span>
        <a href={venueMapsUrl(name, profile)} target="_blank" rel="noopener" style={link}>{profile.address}</a>
        <span style={{ color: colors.textSoft }}> {pt ? '(ver no mapa)' : '(open map)'}</span>
      </p>
      {profile.website && (
        <p style={row}>
          <span style={label}>{pt ? 'Página oficial:' : 'Official page:'}</span>
          <a href={profile.website} target="_blank" rel="noopener" style={link}>{host}</a>
        </p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: colors.textSoft }}>
        {pt
          ? `Verificado em ${new Date(profile.checkedAt + 'T00:00:00Z').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}. Confirme horários no site do local.`
          : `Checked ${new Date(profile.checkedAt + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}. Check opening hours on the venue's site.`}
      </p>
    </section>
  );
}
