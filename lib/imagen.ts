// Gemini 3 Pro Image (Nano Banana Pro) image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-3-pro-image-preview';
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Per-attempt ceiling on Gemini 3 Pro Image. Typical 10-25s; tail can
// reach 30-50s. We retry once on timeout/5xx, so the total budget is
// ATTEMPT_TIMEOUT_MS × MAX_ATTEMPTS + backoffs ≈ 70s worst case.
const ATTEMPT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const BACKOFF_MS = 5_000;

/**
 * Generates an image using Google Gemini 3 Pro Image (Nano Banana Pro).
 * Returns the raw image bytes as a base64 string.
 *
 * Retries once on transient failures (timeout, 5xx, empty body). Throws
 * on hard 4xx errors or after both attempts fail, so callers can decide
 * whether to fall back or surface the failure.
 *
 * Background: 2026-06-02 the blog-promo cron failed because a single
 * generateImage call timed out at 30s. Adding one retry roughly squares
 * the timeout-only failure rate (e.g. 5% × 5% = 0.25% instead of 5%),
 * which is the right move for a step where the only "downside" of a
 * retry is +30s wall-time and one extra Gemini call.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '3:4' | '4:3' = '16:9'
): Promise<{ base64: string; mimeType: string }> {
  const fullPrompt = `Generate a high-quality image (${aspectRatio} aspect ratio): ${prompt}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(IMAGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      // Hard failures (4xx auth/quota/validation) — don't retry.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`Image generation failed (hard): ${res.status} ${await res.text()}`);
      }
      // Soft failures (5xx) — retry.
      if (!res.ok) {
        throw new Error(`Image generation soft fail: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData)?.inlineData;
      if (!imagePart?.data) {
        // Empty response — treat as retryable; sometimes Gemini returns
        // text-only without the image part on overload.
        throw new Error('Gemini Image returned no image data');
      }

      if (attempt > 1) console.log(`[imagen] succeeded on attempt ${attempt}`);
      return {
        base64: imagePart.data,
        mimeType: imagePart.mimeType ?? 'image/png',
      };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Don't retry hard 4xx failures.
      if (msg.includes('(hard)')) throw err;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[imagen] attempt ${attempt} failed, retrying in ${BACKOFF_MS}ms: ${msg}`);
        await new Promise(r => setTimeout(r, BACKOFF_MS));
      }
    }
  }
  throw new Error(`Image generation failed after ${MAX_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
