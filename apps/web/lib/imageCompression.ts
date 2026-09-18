"use client";

// Phone camera photos are commonly 5-10 MB. On the patchy rural
// connectivity this app is built for, that's slow to upload and more
// likely to fail mid-transfer (landing in the offline queue unnecessarily)
// than it needs to be. This downsizes and re-encodes the image entirely
// in the browser via <canvas> before it's ever sent — no library needed,
// every modern mobile browser supports this natively.
const MAX_DIMENSION = 1600; // px, long edge — plenty of detail for the model
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  // Skip non-image files defensively, and skip anything already small
  // (e.g. a screenshot or already-compressed photo) rather than
  // re-encoding it and risking a slightly larger output.
  if (!file.type.startsWith("image/") || file.size < 400_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      // Compression didn't actually help (rare, but possible for already
      // efficiently-encoded images) — keep the original.
      return file;
    }

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // createImageBitmap/canvas can fail on some formats/browsers — fail
    // open and upload the original rather than blocking the diagnosis.
    return file;
  }
}