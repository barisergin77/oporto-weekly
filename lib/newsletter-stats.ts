/**
 * Per-issue newsletter stats from Resend's /emails list.
 *
 * Both batch sends and Broadcast sends show up in /emails (one row per
 * recipient, with `last_event`), so grouping newsletter rows by subject
 * gives per-edition numbers regardless of which path delivered them.
 * Resend keeps 30 days of email data on our plan — plenty for "this
 * week + last week".
 *
 * last_event is the furthest event reached, so counts are cumulative:
 * clicked ⊂ opened ⊂ delivered.
 */

const API = 'https://api.resend.com';

export interface IssueStats {
  subject: string;
  sentAt: string; // earliest created_at in the group
  lang: 'en' | 'pt';
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

type EmailRow = { subject?: string; from?: string; created_at: string; last_event?: string };

// Newsletter subjects: "Oporto Weekly: 19 November 2026" (EN) and
// "Oporto Weekly: 19-25 de novembro de 2026" (PT). Older editions used an
// em dash. Excludes welcome emails and the subscriber report.
// Resend timestamps look like "2026-11-25 22:58:29.958000+00".
function parseTs(v: string): Date {
  const m = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/);
  return m ? new Date(`${m[1]}T${m[2]}${m[3] ? m[3].slice(0, 4) : ''}Z`) : new Date(v);
}

const NEWSLETTER_SUBJECT = /^Oporto Weekly[:—–-]\s*\d/;

export async function getRecentIssueStats(sinceDays = 9): Promise<IssueStats[]> {
  const since = Date.now() - sinceDays * 86_400_000;
  const rows: EmailRow[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url = `${API}/emails?limit=100${after ? `&after=${after}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Resend GET /emails → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: Array<EmailRow & { id: string }>; has_more?: boolean };
    const data = json.data ?? [];
    rows.push(...data);
    const oldest = data[data.length - 1];
    if (!json.has_more || !oldest || parseTs(oldest.created_at).getTime() < since) break;
    after = oldest.id;
  }

  const groups = new Map<string, IssueStats>();
  for (const r of rows) {
    const subject = (r.subject ?? '').trim();
    if (!NEWSLETTER_SUBJECT.test(subject) || /subscribers/i.test(subject)) continue;
    if (!String(r.from ?? '').includes('hello@oportoweekly.com')) continue;
    const t = parseTs(r.created_at);
    if (t.getTime() < since) continue;
    let g = groups.get(subject);
    if (!g) {
      g = {
        subject, sentAt: t.toISOString(), lang: / de [a-zç]+ de \d{4}$/i.test(subject) ? 'pt' : 'en',
        recipients: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0,
      };
      groups.set(subject, g);
    }
    if (t.toISOString() < g.sentAt) g.sentAt = t.toISOString();
    g.recipients++;
    const ev = r.last_event ?? '';
    if (ev === 'bounced') g.bounced++;
    else if (ev === 'complained') { g.complained++; g.delivered++; }
    else if (['delivered', 'opened', 'clicked'].includes(ev)) {
      g.delivered++;
      if (ev === 'opened' || ev === 'clicked') g.opened++;
      if (ev === 'clicked') g.clicked++;
    }
  }
  return Array.from(groups.values()).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

/** HTML section for the weekly subscriber report. */
export function renderIssueStatsHtml(issues: IssueStats[], unsub: { en: number; pt: number } | null): string {
  if (issues.length === 0) return '';
  const rows = issues.map((s, i) => `
    <tr style="${i < issues.length - 1 ? 'border-bottom:1px solid #e5dfd3;' : ''}">
      <td style="padding:8px 0;">${s.subject.replace(/^Oporto Weekly[:—–-]\s*/, '')} <span style="color:#8a8170;font-size:12px;">${s.lang.toUpperCase()}</span></td>
      <td style="text-align:right;">${s.recipients}</td>
      <td style="text-align:right;">${s.delivered}</td>
      <td style="text-align:right;font-weight:600;">${s.opened} <span style="color:#8a8170;font-size:12px;">${pct(s.opened, s.delivered)}</span></td>
      <td style="text-align:right;">${s.clicked} <span style="color:#8a8170;font-size:12px;">${pct(s.clicked, s.delivered)}</span></td>
      <td style="text-align:right;color:${s.bounced ? '#b3261e' : '#8a8170'};">${s.bounced}</td>
    </tr>`).join('');
  return `
  <h2 style="font-family:Georgia,serif;font-size:17px;margin:28px 0 4px;">✉️ Newsletter performance</h2>
  <p style="color:#5a5a5a;margin:0 0 8px;font-size:12px;">Per issue, from Resend. Today's issue keeps collecting opens for a few days.${unsub ? ` Unsubscribes this week: EN ${unsub.en}, PT ${unsub.pt}.` : ''}</p>
  <table style="font-size:14px;border-collapse:collapse;width:100%;">
    <tr style="border-bottom:2px solid #1a1a2e;">
      <th style="text-align:left;padding:8px 0;">Issue</th>
      <th style="text-align:right;padding:8px 0;">Sent</th>
      <th style="text-align:right;padding:8px 0;">Delivered</th>
      <th style="text-align:right;padding:8px 0;">Opened</th>
      <th style="text-align:right;padding:8px 0;">Clicked</th>
      <th style="text-align:right;padding:8px 0;">Bounced</th>
    </tr>${rows}
  </table>`;
}
