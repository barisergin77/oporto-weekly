/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permanent redirects for consolidated duplicate event slugs.
  // Long-running exhibitions occasionally get re-extracted into a new
  // weekly slug — when we dedupe to a canonical record we map the
  // outgoing slug here so any inbound traffic (existing newsletter
  // emails already in inboxes, indexed search results, external links)
  // still lands somewhere useful.
  async redirects() {
    // Format: { from: <retired slug>, to: <canonical slug> }
    const dedupes = [
      // Pink Area (handled in earlier commit; kept here for completeness).
      ['its-a-pink-area-casa-sao-roque-apr-30-2026', 'its-a-pink-area-casa-sao-roque-apr-23-2026'],
      // Long-running exhibitions / weekly markets that got re-extracted.
      ['impressive-monet-brilliant-klimt-alfandega-congress-center-apr-23-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['mercado-beira-rio-vila-nova-de-gaia-may-1-2026', 'mercado-beira-rio-vila-nova-de-gaia-apr-19-2026'],
      ['mercado-beira-rio-vila-nova-de-gaia-may-2-2026', 'mercado-beira-rio-vila-nova-de-gaia-apr-19-2026'],
      ['mercado-porto-belo-praca-de-carlos-alberto-may-2-2026', 'mercado-porto-belo-praca-de-carlos-alberto-apr-25-2026'],
      ['mercado-do-bolhao-central-porto-may-2-2026', 'mercado-do-bolhao-central-porto-apr-25-2026'],
      ['vivian-maier-antologia-centro-portugues-de-fotografia-apr-30-2026', 'vivian-maier-antologia-centro-portugues-de-fotografia-apr-16-2026'],
      ['world-of-discoveries-miragaia-apr-30-2026', 'world-of-discoveries-miragaia-apr-23-2026'],
    ];
    return dedupes.map(([from, to]) => ({
      source: `/event/${from}`,
      destination: `/event/${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
