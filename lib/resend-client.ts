import { Resend } from 'resend';

const FROM = 'Oporto Weekly <hello@oportoweekly.com>';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function sendEmail(to: string, subject: string, html: string) {
  const { error } = await getResend().emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend sendEmail failed: ${JSON.stringify(error)}`);
}

export async function sendBatch(
  emails: string[],
  subject: string,
  html: string
): Promise<number> {
  if (emails.length === 0) return 0;

  const resend = getResend();
  const CHUNK = 100;
  let sent = 0;

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const payload = chunk.map(to => ({ from: FROM, to, subject, html }));
    const { error } = await resend.batch.send(payload);
    if (error) throw new Error(`Resend batch failed: ${JSON.stringify(error)}`);
    sent += chunk.length;
  }

  return sent;
}
