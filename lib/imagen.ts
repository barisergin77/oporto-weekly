// Gemini 3 Pro Image (Nano Banana Pro) image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-3-pro-image-preview';
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Generates an image using Google Gemini 3 Pro Image (Nano Banana Pro).
 * Returns the raw image bytes as a base64 string.
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
