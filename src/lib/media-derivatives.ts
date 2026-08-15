const PHOTO_DISPLAY_MAX_PX = 2048;
const MEDIA_THUMBNAIL_MAX_PX = 480;

type PreparedMedia = {
  primary: File;
  thumbnail: File | null;
  width: number | null;
  height: number | null;
  duration: number | null;
};

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image conversion failed.")), "image/webp", quality));
}

async function drawImage(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, maxPx: number, quality: number) {
  const scale = Math.min(1, maxPx / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image conversion is unavailable in this browser.");
  context.drawImage(source, 0, 0, width, height);
  return { blob: await canvasBlob(canvas, quality), width, height };
}

async function preparePhoto(file: File): Promise<PreparedMedia> {
  const heicByName = /\.hei[cf]$/i.test(file.name);
  const heicByType = file.type === "image/heic" || file.type === "image/heif";
  let bitmap: ImageBitmap;
  if (heicByName || heicByType) {
    const { heicTo } = await import("heic-to/next");
    bitmap = await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  } else {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  }
  try {
    const display = await drawImage(bitmap, bitmap.width, bitmap.height, PHOTO_DISPLAY_MAX_PX, .84);
    const thumb = await drawImage(bitmap, bitmap.width, bitmap.height, MEDIA_THUMBNAIL_MAX_PX, .76);
    const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
    return {
      primary: new File([display.blob], `${stem}.webp`, { type: "image/webp", lastModified: file.lastModified }),
      thumbnail: new File([thumb.blob], `${stem}-thumb.webp`, { type: "image/webp", lastModified: file.lastModified }),
      width: display.width, height: display.height, duration: null,
    };
  } finally { bitmap.close(); }
}

async function prepareVideo(file: File): Promise<PreparedMedia> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true; video.preload = "metadata"; video.playsInline = true; video.src = url;
    await new Promise<void>((resolve, reject) => { video.onloadeddata = () => resolve(); video.onerror = () => reject(new Error("Video preview could not be created.")); });
    if (video.duration > .15) { video.currentTime = Math.min(.1, video.duration / 2); await new Promise<void>((resolve) => { video.onseeked = () => resolve(); }); }
    const thumb = await drawImage(video, video.videoWidth, video.videoHeight, MEDIA_THUMBNAIL_MAX_PX, .76);
    const stem = file.name.replace(/\.[^.]+$/, "") || "video";
    return { primary: file, thumbnail: new File([thumb.blob], `${stem}-thumb.webp`, { type: "image/webp", lastModified: file.lastModified }), width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(video.duration) ? video.duration : null };
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type.startsWith("video/")) return prepareVideo(file);
  return preparePhoto(file);
}
