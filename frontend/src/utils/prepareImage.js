/**
 * Turns whatever came out of the phone's photo picker into something worth
 * uploading.
 *
 * A modern phone photo is 4000px wide and 6 MB. The card renders it at roughly
 * 640px. Sending the original would cost the host their data, cost the guest
 * their load time, and fill the storage bucket with pixels nobody sees — so the
 * file is decoded, drawn down to a sane long edge, and re-encoded as JPEG before
 * it leaves the browser.
 *
 * HEIC (the iPhone default) cannot be decoded by most browsers. The load will
 * reject and the caller shows the message rather than uploading a file the card
 * would fail to render.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // pre-compression guard
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

const MAX_EDGE = 1600;
const QUALITY = 0.86;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "This browser can't open that image. HEIC photos from an iPhone need to be exported as JPEG first."
        )
      );
    img.src = src;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{blob: Blob, previewUrl: string, width: number, height: number}>}
 *   `previewUrl` is an object URL the caller owns and must revoke.
 */
export async function prepareCoverImage(file) {
  if (!file) throw new Error('No file selected.');
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Use a JPEG, PNG, WebP or GIF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is over 8 MB. Try a smaller one.');
  }

  const img = await loadImage(await readAsDataUrl(file));

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Flatten onto the card background so a transparent PNG does not render as a
  // white box on a dark card.
  ctx.fillStyle = '#0b0d14';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      QUALITY
    );
  });

  return { blob, previewUrl: URL.createObjectURL(blob), width, height };
}
