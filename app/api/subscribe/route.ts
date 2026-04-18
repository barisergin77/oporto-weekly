export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { addSubscriber } from '@/lib/audiences';
import { sendEmail } from '@/lib/resend-client';

const WELCOME_HTML_EN = `
<!DOCTYPE html>
<html>
<body style="background:#1a1a2e;color:#ccd6f6;font-family:Georgia,serif;padding:2rem;max-width:600px;margin:auto;">
  <h1 style="color:#c9a96e;">Welcome to Oporto Weekly</h1>
  <p>You're now subscribed to the best weekly guide to Porto.</p>
  <p>Every Thursday morning, you'll get:</p>
  <ul>
    <li>Concerts & live music</li>
    <li>Art & exhibitions</li>
    <li>Food markets & wine events</li>
    <li>Family activities</li>
    <li>Nightlife picks</li>
  </ul>
  <p>First issue lands this Thursday. See you then!</p>
  <p style="color:#8892b0;font-size:0.85rem;">© Oporto Weekly · Porto, Portugal</p>
</body>
</html>
`;

const WELCOME_HTML_PT = `
<!DOCTYPE html>
<html lang="pt">
<body style="background:#1a1a2e;color:#ccd6f6;font-family:Georgia,serif;padding:2rem;max-width:600px;margin:auto;">
  <h1 style="color:#c9a96e;">Bem-vindo ao Oporto Weekly</h1>
  <p>Está agora subscrito ao melhor guia semanal do Porto.</p>
  <p>Todas as quintas-feiras de manhã, vai receber:</p>
  <ul>
    <li>Concertos e música ao vivo</li>
    <li>Arte e exposições</li>
    <li>Mercados gastronómicos e eventos de vinho</li>
    <li>Atividades em família</li>
    <li>Sugestões de vida noturna</li>
  </ul>
  <p>A primeira edição chega esta quinta-feira. Até lá!</p>
  <p style="color:#8892b0;font-size:0.85rem;">© Oporto Weekly · Porto, Portugal</p>
</body>
</html>
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email: string = body.email?.trim().toLowerCase();
    const lang: 'en' | 'pt' = body.lang === 'pt' ? 'pt' : 'en';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Add to Beehiiv with language tag
    await addSubscriber(email, lang);

    // Send welcome email in the right language, tagged so welcome-flow opens
    // don't pollute newsletter analytics on the Resend dashboard.
    const subject = lang === 'pt' ? 'Bem-vindo ao Oporto Weekly' : 'Welcome to Oporto Weekly';
    const html = lang === 'pt' ? WELCOME_HTML_PT : WELCOME_HTML_EN;
    await sendEmail(email, subject, html, [
      { name: 'type', value: 'welcome' },
      { name: 'lang', value: lang },
    ]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[subscribe]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
