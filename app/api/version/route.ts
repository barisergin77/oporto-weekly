/**
 * Which commit is live. Used by .github/workflows/deploy-flush.yml to tell
 * whether deferred commits (enrichment-only — see
 * scripts/vercel-ignore-build.sh) are still waiting to be deployed.
 * A commit SHA is not sensitive, so this is unauthenticated.
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
