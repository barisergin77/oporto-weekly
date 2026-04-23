// Gemini 3 Pro Image (Nano Banana Pro) image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-3-pro-image-preview';
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Hard ceiling on how long we'll wait for one image. Gemini 3 Pro Image
// typically completes in 10-25s; a hung call (observed on 2026-04-23
// pushing the event-images cron past Vercel's 300s ceiling) was what
// caused the cron to timeout entirely. 45s is generous for the happy
// path while short enough that a slow call fails fast and lets the
// caller skip to the next event.
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Generates an image using Google Gemini 3 Pro Image (Nano Banana Pro).
 * Returns the raw image bytes as a base64 string.
 *
 * Throws on timeout / HTTP failure / empty response so callers can
 * decide whether to retry, fall back, or skip.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '3:4' | '4:3' = '16:9'
): Promise<{ base64: string; mimeType: string }> {
  const fullPrompt = `Generate a high-quality image (${aspectRatio} aspect ratio): ${prompt}`;

  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData)?.inlineData;

  if (!imagePart?.data) {
    throw new Error('Gemini Image returned no image data');
  }

  return {
    base64: imagePart.data,
    mimeType: imagePart.mimeType ?? 'image/png',
  };
}
