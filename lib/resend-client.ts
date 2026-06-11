import { Resend } from 'resend';

const FROM = 'Oporto Weekly <hello@oportoweekly.com>';
const SITE = 'https://oportoweekly.com';

// Resend tag: name + value, each ≤256 chars and only ASCII letters, digits,
// underscores, or dashes. Max 10 tags per send. Used on the Resend dashboard
// to slice open/click rates by edition, language, email type, etc.
export type ResendTag = { name: string; value: string };

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function unsubUrl(email: string) {
  return `${SITE}/api/unsubscribe?email=${encodeURIComponent(email)}`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  tags?: ResendTag[]
) {
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl(to)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    ...(tags && tags.length > 0 ? { tags } : {}),
  });
  if (error) throw new Error(`Resend sendEmail failed: ${JSON.stringify(error)}`);
}

/**
 * Thrown when sendBatch fails AFTER at least one chunk was delivered.
 * Callers that release idempotency claims on failure MUST NOT do so for
 * this error — a retry would re-send to everyone in the delivered
 * chunks. (Resend's batch API takes 100 recipients per call; lists over
 * 100 are chunked, and a chunk boundary is a partial-delivery hazard.)
 */
export class PartialSendError extends Error {
  constructor(
    public readonly sentCount: number,
    public readonly totalCount: number,
    cause: string
  ) {
    super(`Partial send: ${sentCount}/${totalCount} delivered before failure — ${cause}`);
    this.name = 'PartialSendError';
  }
}

export async function sendBatch(
  emails: string[],
  subject: string,
  html: string,
  tags?: ResendTag[]
): Promise<number> {
  if (emails.length === 0) return 0;

  const resend = getResend();
  const CHUNK = 100;
  let sent = 0;
  const hasTags = tags && tags.length > 0;

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const payload = chunk.map(to => ({
      from: FROM,
      to,
      subject,
      // Replace placeholder with subscriber's actual email for unsubscribe link
      html: html.replace(/SUBSCRIBER_EMAIL/g, encodeURIComponent(to)),
      headers: {
        'List-Unsubscribe': `<${unsubUrl(to)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ...(hasTags ? { tags } : {}),
    }));
    const { error } = await resend.batch.send(payload);
    if (error) {
      const cause = JSON.stringify(error);
      if (sent > 0) throw new PartialSendError(sent, emails.length, cause);
      throw new Error(`Resend batch failed: ${cause}`);
    }
    sent += chunk.length;
  }

  return sent;
}
