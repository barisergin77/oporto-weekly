// Google Imagen 3 image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`; // Using gemini-1.5-flash for image capabilities

/**
 * Generates an image using Google Gemini-1.5-Flash (or similar multimodal model).
 * Returns the raw image bytes as a base64 string.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '3:4' | '4:3' = '16:9'
): Promise<{ base64: string; mimeType: string }> {
  // Note: Gemini-1.5-Flash generateContent API doesn't directly support aspectRatio or sampleCount
  // as it's primarily a multimodal model. These parameters will be omitted or handled by prompt.
  const res = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Generate an image for: ${prompt}. Aspect ratio: ${aspectRatio}.` }] }],
      generationConfig: {
        responseMimeType: 'image/png', // Request image output
        maxOutputTokens: 2048 // Sufficient for image data
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
