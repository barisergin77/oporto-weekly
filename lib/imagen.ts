// Google Imagen 3 image generation via the Generative Language API.
// Uses the same GEMINI_API_KEY as the newsletter pipeline.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`; // Using Nano Banana Pro

/**
 * Generates an image using Google Gemini-3-Pro-Image.
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
      contents: [{ parts: [{ text: `Generate an image for: ${prompt}. Aspect ratio: ${aspectRatio}.` }] }],
      generationConfig: {
        responseMimeType: 'image/png', // Request image output
        maxOutputTokens: 2048, // Sufficient for image data
        stopSequences: [], // No stop sequences needed for image output
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Imagen 3 generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const imagePart = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!imagePart?.data) {
    throw new Error('Gemini Image returned no image data');
  }

  return {
    base64: imagePart.data,
    mimeType: imagePart.mimeType ?? 'image/png',
  };
}
