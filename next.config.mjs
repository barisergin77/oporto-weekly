/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permanent redirects for consolidated duplicate event slugs.
  // Long-running exhibitions occasionally get re-extracted into a new
  // weekly slug — when we dedupe to a canonical record we map the
  // outgoing slug here so any inbound traffic (existing newsletter
  // emails already in inboxes, indexed search results, external links)
  // still lands somewhere useful.
  async redirects() {
    return [
      {
        source: '/event/its-a-pink-area-casa-sao-roque-apr-30-2026',
        destination: '/event/its-a-pink-area-casa-sao-roque-apr-23-2026',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
