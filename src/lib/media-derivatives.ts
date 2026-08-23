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
    video.muted = true; video.preload = "auto"; video.playsInline = true; video.src = url;
    const waitFor = (eventName: "loadedmetadata" | "loadeddata" | "seeked", timeoutMs: number) => new Promise<boolean>((resolve) => {
      const finish = (ready: boolean) => { window.clearTimeout(timer); video.removeEventListener(eventName, onReady); video.removeEventListener("error", onError); resolve(ready); };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      video.addEventListener(eventName, onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
    const metadataPromise = waitFor("loadedmetadata", 8000);
    video.load();
    const metadataReady = video.readyState >= 1 || await metadataPromise;
    const width = metadataReady ? video.videoWidth || null : null;
    const height = metadataReady ? video.videoHeight || null : null;
    const duration = metadataReady && Number.isFinite(video.duration) ? video.duration : null;
    let thumbnail: File | null = null;
    const frameReady = video.readyState >= 2 || await waitFor("loadeddata", 6000);
    if (frameReady && width && height) {
      if (duration && duration > .15) {
        const seekPromise = waitFor("seeked", 3500);
        video.currentTime = Math.min(.1, duration / 2);
        await seekPromise;
      }
      try {
        const thumb = await drawImage(video, width, height, MEDIA_THUMBNAIL_MAX_PX, .76);
        const stem = file.name.replace(/\.[^.]+$/, "") || "video";
        thumbnail = new File([thumb.blob], `${stem}-thumb.webp`, { type: "image/webp", lastModified: file.lastModified });
      } catch { /* A poster is optional; never block the video upload. */ }
    }
    return { primary: file, thumbnail, width, height, duration };
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type.startsWith("video/")) return prepareVideo(file);
  return preparePhoto(file);
}
