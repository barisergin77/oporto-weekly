export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend-client';
import { checkCronAuth } from '@/lib/cron-auth';

const SITE = 'https://oportoweekly.com';
const ALERT_EMAIL = 'barisergin@gmail.com';

interface CheckResult {
  name: string;
  ok: boolean;
  details: string;
}

async function checkPage(name: string, url: string, mustContain: string[]): Promise<CheckResult> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { name, ok: false, details: `HTTP ${res.status}` };
    }
    const html = await res.text();

    // Check page isn't a real 404 (not just the RSC error boundary template)
    // A real 404 has the 404 title as the ONLY title and lacks the expected content
    if (html.includes('<h2 style="font-size:14px') && html.includes('This page could not be found') && !mustContain.some(m => html.includes(m))) {
      return { name, ok: false, details: 'Renders as 404' };
    }

    // Check for required content markers
    for (const marker of mustContain) {
      if (!html.includes(marker)) {
        return { name, ok: false, details: `Missing: "${marker}"` };
      }
    }

    // Check HTML pages aren't suspiciously short (like the regex bug that ate content)
    // XML feeds/sitemaps are naturally smaller, so only check HTML pages
    const isHtmlPage = !url.includes('.xml');
    if (isHtmlPage && html.length < 5000) {
      return { name, ok: false, details: `Page too short: ${html.length} bytes` };
    }

    return { name, ok: true, details: `${(html.length / 1024).toFixed(0)}KB` };
  } catch (err) {
    return { name, ok: false, details: err instanceof Error ? err.message : 'Fetch failed' };
  }
}

// ---------------------------------------------------------------------------
// Credential checks
//
// 2026-10-04: BUFFER_API_KEY and GITHUB_TOKEN were both found already revoked
// in production — nothing had noticed, and the next Thursday run would have
// failed mid-cascade (no archive commit, no Instagram post). Both are now
// 90-day keys, so they WILL expire again. These checks turn that into an
// alert email days ahead instead of a failed edition.
// ---------------------------------------------------------------------------
const EXPIRY_WARN_DAYS = 14;

async function checkGitHubToken(): Promise<CheckResult> {
  const name = 'GitHub token';
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { name, ok: false, details: 'GITHUB_TOKEN not set' };
  try {
    const res = await fetch('https://api.github.com/repos/barisergin77/oporto-weekly', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { name, ok: false, details: `HTTP ${res.status} — token invalid or revoked` };
    const body = (await res.json()) as { permissions?: { push?: boolean } };
    if (!body.permissions?.push) return { name, ok: false, details: 'No write access to the repo' };

    // Fine-grained PATs report their expiry in this header.
    const exp = res.headers.get('github-authentication-token-expiration');
    if (!exp) return { name, ok: true, details: 'valid (no expiry reported)' };
    const days = Math.floor((new Date(exp.replace(' UTC', 'Z').replace(' ', 'T')).getTime() - Date.now()) / 86400000);
    if (Number.isNaN(days)) return { name, ok: true, details: `valid (expiry: ${exp})` };
    if (days <= EXPIRY_WARN_DAYS) {
      return { name, ok: false, details: `Expires in ${days} day(s) (${exp}) — regenerate and update GITHUB_TOKEN` };
    }
    return { name, ok: true, details: `valid, ${days} days left` };
  } catch (err) {
    return { name, ok: false, details: err instanceof Error ? err.message : 'check failed' };
  }
}

async function checkBufferKey(): Promise<CheckResult> {
  const name = 'Buffer API key';
  const key = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_CHANNEL_ID;
  if (!key || !channelId) return { name, ok: false, details: 'BUFFER_API_KEY / BUFFER_CHANNEL_ID not set' };
  try {
    // Read-only query — never creates a post. Buffer does not expose key
    // expiry, so this can only report validity, not days remaining.
    const res = await fetch('https://api.buffer.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: 'query($id: ChannelId!){ channel(input:{id:$id}) { id service name isDisconnected isLocked } }',
        variables: { id: channelId },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as {
      data?: { channel?: { name?: string; isDisconnected?: boolean; isLocked?: boolean } };
      errors?: Array<{ message?: string }>;
    };
    if (data.errors?.length) return { name, ok: false, details: data.errors[0].message ?? 'API error' };
    const ch = data.data?.channel;
    if (!ch) return { name, ok: false, details: 'Channel not found' };
    if (ch.isDisconnected) return { name, ok: false, details: `Instagram channel @${ch.name} is disconnected in Buffer` };
    if (ch.isLocked) return { name, ok: false, details: `Instagram channel @${ch.name} is locked in Buffer` };
    return { name, ok: true, details: `valid, @${ch.name} connected` };
  } catch (err) {
    return { name, ok: false, details: err instanceof Error ? err.message : 'check failed' };
  }
}

export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const checks: CheckResult[] = await Promise.all([
    checkPage('Homepage (EN)', SITE, ['Oporto Weekly', 'Subscribe']),
    checkPage('Homepage (PT)', `${SITE}/pt`, ['Oporto Weekly', 'Subscrever']),
    checkPage('Archive', `${SITE}/archive`, ['Oporto Weekly']),
    checkPage('Blog', `${SITE}/blog`, ['Oporto Weekly']),
    checkPage('Porto Events', `${SITE}/porto-events`, ['Porto Events']),
    checkPage('Sitemap', `${SITE}/sitemap.xml`, ['<urlset', '<loc>']),
    checkPage('RSS Feed', `${SITE}/feed.xml`, ['<rss', '<channel>']),
    checkGitHubToken(),
    checkBufferKey(),
  ]);

  const failures = checks.filter(c => !c.ok);
  const allOk = failures.length === 0;

  // Log results
  for (const c of checks) {
    console.log(`[health] ${c.ok ? '✓' : '✗'} ${c.name}: ${c.details}`);
  }

  // Send alert email if anything failed
  if (!allOk) {
    const failureList = failures
      .map(f => `• ${f.name}: ${f.details}`)
      .join('\n');

    const alertHtml = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;">
        <h2 style="color:#e74c3c;">⚠️ Oporto Weekly Health Check Failed</h2>
        <p><strong>${failures.length} of ${checks.length} checks failed:</strong></p>
        <pre style="background:#f8f8f8;padding:16px;border-radius:4px;font-size:14px;">${failureList}</pre>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="font-size:12px;color:#999;">
          Full results:<br/>
          ${checks.map(c => `${c.ok ? '✅' : '❌'} ${c.name}: ${c.details}`).join('<br/>')}
        </p>
        <p style="font-size:12px;color:#999;">Automated check from oportoweekly.com/api/cron/health</p>
      </div>
    `;

    try {
      await sendEmail(
        ALERT_EMAIL,
        `⚠️ Site health check failed — ${failures.length} issue${failures.length > 1 ? 's' : ''}`,
        alertHtml,
        [{ name: 'type', value: 'health-alert' }]
      );
      console.log(`[health] Alert email sent to ${ALERT_EMAIL}`);
    } catch (emailErr) {
      console.error('[health] Failed to send alert email:', emailErr);
    }
  }

  return NextResponse.json({
    ok: allOk,
    checks: checks.map(c => ({ name: c.name, ok: c.ok, details: c.details })),
    failures: failures.length,
  });
}

// POST alias: mutating cron endpoints should not be GET-only. GET
// requests may be transparently retried by infrastructure (CDN, edge,
// runtime) — the suspected cause of the 2026-05-21 double-pipeline.
// Workflows call POST; GET stays for backwards-compat/manual testing.
export { GET as POST };
