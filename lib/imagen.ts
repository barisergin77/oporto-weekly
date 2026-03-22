// Google Imagen 3 image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`;

/**
 * Generates an image using Google Imagen 3.
 * Returns the raw image bytes as a base64 string.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '3:4' | '4:3' = '16:9'
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
        // Keep safety filter at moderate level
        safetyFilterLevel: 'block_medium_and_above',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Imagen 3 generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const prediction = data?.predictions?.[0];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen 3 returned no image data');
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType ?? 'image/png',
  };
}
