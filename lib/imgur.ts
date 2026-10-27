// Uploads a base64-encoded image to Imgur and returns a public URL.
// Used for newsletter hero images and Instagram posts where we need
// a stable public URL without depending on Vercel deploys completing first.

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID!;

export async function uploadImageToImgur(imageBase64: string): Promise<string> {
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `image=${encodeURIComponent(imageBase64)}&type=base64`,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.success || !data.data?.link) {
    throw new Error(`Imgur upload failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.data.link as string;
}

// Uploads an MP4 (Instagram Reel, owner 2026-10-27) to Imgur and returns its public .mp4 URL.
// Imgur takes videos up to 60s / 200MB; the reel pipeline keeps scripts under ~55s.
export async function uploadVideoToImgur(video: ArrayBuffer): Promise<string> {
  const form = new FormData();
  form.append('video', new Blob([video], { type: 'video/mp4' }), 'reel.mp4');
  form.append('type', 'file');
  const res = await fetch('https://api.imgur.com/3/upload', {
    method: 'POST',
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
    body: form,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!data.success || !data.data?.link) {
    throw new Error(`Imgur video upload failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return String(data.data.link).replace(/\.gifv$/, '.mp4');
}
