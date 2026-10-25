/**
 * Thursday ~07:45 UTC — owner test copy of this week's EN edition
 * (owner decision 2026-10-25). cron-newsletter-test.yml first runs the normal
 * generation endpoint (/api/cron/newsletter: compose + archive, idempotent),
 * then calls this, so the owner reads EXACTLY the archived edition that
 * /api/cron/newsletter-send mails to subscribers ~15 minutes later.
 *
 * Sends to NEWSLETTER_TEST_TO only (one address; unset → skipped). Subject
 * "[TEST] …". Never touches audiences or the run ledger, never blocks the
 * real send: it is not part of the 08:00 cascade, a failure here changes
 * nothing downstream, and it skips once the subscriber send has happened.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { generateSlug, formatWeekRange, thursdayWeekStart } from '@/lib/archive';
import { getFileContent } from '@/lib/github';
import { sendEmail } from '@/lib/resend-client';
import { withForwardBlock } from '@/lib/forward-block';
import { checkCronAuth } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const now = new Date();
    const force = new URL(req.url).searchParams.get('force') === 'true';
    if (now.getUTCDay() !== 4 && !force) {
      return NextResponse.json({ skipped: true, reason: 'not-thursday' });
    }
    const to = (process.env.NEWSLETTER_TEST_TO ?? '').trim();
    if (!to || to.includes(',') || !/^[^@\s]+@[^@\s]+$/.test(to)) {
      return NextResponse.json({ skipped: true, reason: 'NEWSLETTER_TEST_TO not set to a single address' });
    }

    const weekStart = thursdayWeekStart(now);
    const slug = generateSlug(formatWeekRange(weekStart));

    const { isStepComplete } = await import('@/lib/run-ledger');
    if (await isStepComplete(slug, 'en-email')) {
      return NextResponse.json({ skipped: true, reason: 'subscriber send already done', slug });
    }
    const archived = await getFileContent(`public/newsletters/${slug}.html`);
    if (!archived) {
      return NextResponse.json({ skipped: true, reason: 'edition not archived yet', slug });
    }

    const path = /<!-- oporto-weekly:path=(\w+) -->/.exec(archived)?.[1] ?? 'unknown';
    const html = withForwardBlock(archived, 'en', `https://oportoweekly.com/archive/${slug}`)
      .replace(/SUBSCRIBER_EMAIL/g, encodeURIComponent(to));
    const weekDate = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    await sendEmail(to, `[TEST · ${path}] Oporto Weekly — ${weekDate}`, html, [
      { name: 'type', value: 'test' },
      { name: 'lang', value: 'en' },
      { name: 'edition', value: slug },
    ]);
    console.log(`[cron/newsletter-test] sent test copy of ${slug} (path=${path})`);
    return NextResponse.json({ success: true, slug, path, sentTo: 'owner' });
  } catch (err) {
    console.error('[cron/newsletter-test]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export { GET as POST };
