import fs from 'fs';

// Venue alias map — single source of truth shared with lib/venues.ts.
const venueAliases = JSON.parse(fs.readFileSync(new URL('./data/venue-aliases.json', import.meta.url), 'utf-8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raw newsletter HTML in public/newsletters/ exists only as the committed
  // artifact + the send endpoints' "deploy is live" probe. Served publicly,
  // each file is a canonical-less duplicate of /archive/<slug> (or
  // /pt/arquivo/<slug>) and still carries the email footer's /api/unsubscribe
  // links — which GSC then reports as "Blocked by robots.txt". noindex keeps
  // them out of the index; the probe only checks the status code.
  async headers() {
    return [
      {
        source: '/newsletters/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
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
      // 2026-10-25 dedupe (scripts/find-duplicates.ts): same event under a
      // different name / venue spelling / weekly re-extraction.
      ['wrong-answers-exhibition-museo-de-arte-contemporaneo-de-serralves-aug-27-2026', 'jenny-holzer-wrong-answers-serralves-museum-jul-9-2026'],
      ['jenny-holzer-wrong-answers-serralves-museum-of-contemporary-art-sep-3-2026', 'jenny-holzer-wrong-answers-serralves-museum-jul-9-2026'],
      ['opening-holzer-wrong-answers-venue-details-vary-jun-18-2026', 'jenny-holzer-wrong-answers-serralves-museum-jul-9-2026'],
      ['porto-contemporary-art-exhibition-bombarda-art-district-various-oct-15-2026', 'porto-contemporary-art-exhibition-various-galleries-oct-5-2026'],
      ['rival-consoles-live-casa-da-musica-may-1-2026', 'rival-consoles-casa-da-musica-may-1-2026'],
      ['exhibition-opening-call-of-the-west-casa-do-infante-may-22-2026', 'call-of-the-west-exhibition-opening-casa-do-infante-may-22-2026'],
      ['international-puppet-festival-various-venues-oct-15-2026', 'fimp26-international-puppet-festival-various-venues-oct-9-2026'],
      ['dino-experience-alfandega-congress-center-apr-30-2026', 'dino-experience-alfandega-congress-center-apr-17-2026'],
      ['dino-experience-alfandega-do-porto-may-21-2026', 'dino-experience-alfandega-congress-center-apr-17-2026'],
      ['dino-experience-porto-alfandega-do-porto-aug-27-2026', 'dino-experience-alfandega-congress-center-apr-17-2026'],
      ['impressive-monet-brilliant-klimt-alfandega-congress-center-apr-30-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['impressive-monet-brilliant-klimt-immersivus-gallery-apr-30-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['immersive-monet-brilliant-klimt-alfandega-congress-center-jun-25-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['impressive-monet-brilliant-klimt-alfandega-do-porto-aug-27-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['impressive-monet-brilliant-klimt-immersivus-gallery-porto-sep-3-2026', 'impressive-monet-brilliant-klimt-alfandega-congress-center-apr-17-2026'],
      ['elective-affinities-miro-contemporaries-casa-de-serralves-jun-4-2026', 'elective-affinities-joan-miro-serralves-museum-apr-30-2026'],
      ['joan-miro-at-serralves-serralves-museum-jun-11-2026', 'elective-affinities-joan-miro-serralves-museum-apr-30-2026'],
      ['physical-culture-by-augustas-serapinas-galeria-municipal-do-porto-oct-1-2026', 'physical-culture-porto-edition-galeria-municipal-do-porto-jul-30-2026'],
      ['the-century-of-gehry-serralves-museum-of-contemporary-art-sep-3-2026', 'o-seculo-de-gehry-serralves-museum-of-contemporary-art-jul-23-2026'],
      ['iguanas-free-concert-casa-da-musica-may-21-2026', 'iguanas-lo-fi-psychedelia-casa-da-musica-may-21-2026'],
      ['university-choir-of-porto-cd-launch-casa-da-musica-may-22-2026', 'orfeao-universitario-do-porto-album-launch-casa-da-musica-may-22-2026'],
      ['pia-camil-outdoor-installation-galeria-municipal-do-porto-may-21-2026', 'pia-camils-textile-installation-galeria-municipal-do-porto-may-21-2026'],
      ['beginning-serralves-museum-may-23-2026', 'cinthia-marcelles-final-weekend-serralves-museum-may-23-2026'],
      ['explore-mercado-do-bolhao-rua-formosa-may-2-2026', 'explore-mercado-do-bolhao-mercado-do-bolhao-may-2-2026'],
      ['serralves-em-luz-serralves-park-oct-8-2026', 'serralves-em-luz-parque-de-serralves-aug-6-2026'],
      ['feira-do-livro-do-porto-2026-jardins-do-palacio-de-cristal-aug-6-2026', 'feira-do-livro-do-porto-jardins-do-palacio-de-cristal-aug-21-2026'],
      ['porto-book-fair-jardins-do-palacio-de-cristal-aug-27-2026', 'feira-do-livro-do-porto-jardins-do-palacio-de-cristal-aug-21-2026'],
      ['porto-book-fair-crystal-palace-gardens-sep-10-2026', 'feira-do-livro-do-porto-jardins-do-palacio-de-cristal-aug-21-2026'],
      // 2026-10-27: forward scan (10-26) wrote the same page twice in one run.
      ['qui-29-maria-pistolas-oct-29-2026', 'voulez-vous-x-maria-pistolas-maria-pistolas-oct-29-2026'],
      ['moonspell-hard-club-oct-31-2026', 'moonspell-invicta-halloween-hard-club-oct-31-2026'],
      // 2026-10-27 (owner): festival + its exhibition programme, same page and dates.
      ['caminhos-da-floresta-casa-da-musica-nov-12-2026', 'festival-floresta-amazonica-girando-mundos-casa-da-musica-nov-12-2026'],
      // 2026-11-01: same CdM concert from its EN and PT pages (identity now compares PT names too).
      ['organ-symphony-casa-da-musica-nov-21-2026', 'sinfonia-orgao-casa-da-musica-nov-21-2026'],
    ];
    const eventRedirects = dedupes.flatMap(([from, to]) => [
      { source: `/event/${from}`, destination: `/event/${to}`, permanent: true },
      { source: `/pt/event/${from}`, destination: `/pt/event/${to}`, permanent: true },
    ]);
    // 2026-10-27 (owner): adult-show listing removed ("skip that sensual shows thing"), no replacement event.
    const removedEvents = ['halloween-night-at-magic-moments-restaurant-magic-moments-restaurante-dance-club-porto-oct-31-2026'];
    eventRedirects.push(...removedEvents.flatMap((slug) => [
      { source: `/event/${slug}`, destination: '/porto-events/this-weekend', permanent: true },
      { source: `/pt/event/${slug}`, destination: '/pt/eventos/este-fim-de-semana', permanent: true },
    ]));

    // Venue pages for alias slugs ("serralves-museum", "casa-da-musica-sala-2")
    // → the canonical venue page. Driven by data/venue-aliases.json.
    const venuePairs = [
      ...Object.entries(venueAliases.venues).flatMap(([canonical, v]) => v.aliases.map((a) => [a, canonical])),
      ...Object.entries(venueAliases.redirectOnly),
    ];
    const venueRedirects = venuePairs.flatMap(([from, to]) => [
      { source: `/venue/${from}`, destination: `/venue/${to}`, permanent: true },
      { source: `/pt/venue/${from}`, destination: `/pt/venue/${to}`, permanent: true },
    ]);

    // Duplicate guides merged into the stronger slug (by GSC clicks).
    const blogMerges = [
      // 2026-10-26: Sep coffee guide merged into the May one (15 vs 2 clicks).
      ['portos-best-coffee-pastis-de-nata-a-2026-guide', 'portos-best-coffee-pastis-de-nata-the-2026-guide'],
      // 2026-11-01 (owner): 37 auto-written guides consolidated into 15
      // canonical ones (canonical = most GSC clicks Jan-Oct, then impressions),
      // each fact-checked; data/guide-checks.json drives the monthly re-check.
      ['portos-hidden-gems-your-guide-to-the-citys-secrets', 'secret-porto-a-guide-to-the-citys-hidden-gems'],
      ['portos-hidden-gems-your-2025-2026-insiders-guide', 'secret-porto-a-guide-to-the-citys-hidden-gems'],
      ['portos-hidden-gems-uncover-local-secrets-for-2025-2026', 'secret-porto-a-guide-to-the-citys-hidden-gems'],
      ['porto-on-foot-a-self-guided-walk-through-history-2025', 'explore-historic-porto-a-self-guided-walking-tour'],
      ['portos-best-views-top-rooftops-viewpoints-for-2025', 'portos-best-views-rooftops-viewpoints-for-2026'],
      ['the-ultimate-foodies-guide-to-porto-what-to-eat-in-2025', 'the-ultimate-food-guide-to-porto-5-dishes-you-must-try'],
      ['a-food-lovers-guide-to-porto-what-to-eat-in-2025', 'the-ultimate-food-guide-to-porto-5-dishes-you-must-try'],
      ['sip-see-porto-your-2025-2026-port-wine-cellar-guide', 'sip-savor-porto-your-2025-guide-to-port-wine-cellars'],
      ['your-porto-neighborhood-guide-where-to-stay-eat-2025', 'porto-neighborhood-guide-where-to-stay-eat-explore'],
      ['porto-neighborhood-guide-where-to-stay-eat-in-2026', 'porto-neighborhood-guide-where-to-stay-eat-explore'],
      ['porto-nightlife-your-ultimate-after-dark-guide-for-2025', 'porto-nightlife-2025-2026-fado-bars-unforgettable-evenings'],
      ['the-ultimate-seasonal-guide-to-porto-2025-2026', 'porto-a-seasonal-guide-for-your-2025-2026-trip'],
      ['porto-on-a-budget-free-activities-cheap-eats-guide-2025-2026', 'porto-on-a-budget-free-sights-cheap-eats-guide'],
      ['porto-on-a-budget-the-ultimate-free-activity-guide', 'porto-on-a-budget-free-sights-cheap-eats-guide'],
      ['family-fun-in-porto-your-2025-2026-kid-friendly-guide', 'family-fun-porto-kid-friendly-activities-2025-2026'],
      ['porto-with-kids-the-ultimate-family-adventure-guide', 'family-fun-porto-kid-friendly-activities-2025-2026'],
      ['portos-best-beaches-your-2025-2026-swim-surf-guide', 'portos-best-beaches-your-2025-2026-surf-swim-guide'],
      ['shop-like-a-local-in-porto-your-2026-vintage-market-guide', 'porto-shopping-guide-your-map-to-vintage-artisan-finds'],
      ['portos-ultimate-vintage-artisan-shopping-guide-2025', 'porto-shopping-guide-your-map-to-vintage-artisan-finds'],
      ['portos-art-culture-guide-galleries-street-art-in-2025', 'the-ultimate-art-lovers-guide-to-porto-2025-2026'],
      ['best-day-trips-from-porto-the-ultimate-2025-2026-guide', 'porto-day-trips-your-ultimate-douro-valley-wine-guide'],
    ];
    const blogRedirects = blogMerges.flatMap(([from, to]) => [
      { source: `/blog/${from}`, destination: `/blog/${to}`, permanent: true },
      { source: `/pt/blog/${from}`, destination: `/pt/blog/${to}`, permanent: true },
    ]);

    return [...eventRedirects, ...venueRedirects, ...blogRedirects];
  },
};

export default nextConfig;
