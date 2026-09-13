// Vercel Functions have a hard 4.5 MB request-body limit (confirmed against
// Vercel's own docs, updated Nov 2025: vercel.com/kb/guide/how-to-bypass-
// vercel-body-size-limit-serverless-functions). A larger stated limit here
// would be a false promise — the platform would reject the upload with a
// 413 before this code ever runs. If you deploy somewhere without that
// constraint (a self-hosted Node server, for example), this can go higher.
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// The first few bytes of each format, regardless of what the browser
// claims the file's MIME type is or what extension the filename has.
const MAGIC_BYTES: Record<AllowedMimeType, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

function matchesSignature(buffer: Buffer, mimeType: AllowedMimeType): boolean {
  const signature = MAGIC_BYTES[mimeType];
  return signature.every((byte, i) => buffer[i] === byte);
}

export type FileValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validates an uploaded file server-side. Never trusts the filename,
 * extension, or the browser-reported MIME type alone — the type is only
 * accepted after the file's actual bytes confirm it.
 */
export function validateUploadedFile(
  reportedMimeType: string,
  size: number,
  buffer: Buffer
): FileValidationResult {
  if (size === 0) {
    return { ok: false, error: "This file is empty." };
  }
  if (size > MAX_FILE_BYTES) {
    return { ok: false, error: "This file is too large. Maximum size is 4 MB." };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(reportedMimeType)) {
    return { ok: false, error: "Unsupported file type. Upload a PDF, PNG, or JPG." };
  }
  if (!matchesSignature(buffer, reportedMimeType as AllowedMimeType)) {
    return {
      ok: false,
      error: "This file's contents don't match its type and were rejected.",
    };
  }
  return { ok: true };
}
