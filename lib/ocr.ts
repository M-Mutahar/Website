import { createWorker } from "tesseract.js";

// Below this many characters of extracted text, a "text" PDF is almost
// certainly actually a scanned image with no real text layer — pdf-parse
// returns near-empty output for those instead of throwing, so this has to
// be checked explicitly rather than assumed.
const MIN_USABLE_PDF_TEXT_LENGTH = 20;

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Deliberately NOT `await import("pdf-parse")`. pdf-parse's package root
  // (index.js) contains a debug-mode block that runs whenever
  // `module.parent` is undefined and tries to read a hardcoded test file
  // (./test/data/05-versions-space.pdf) that doesn't exist in a deployed
  // bundle — this is a well-documented crash under webpack/serverless
  // bundling (Next.js wraps modules in a way that makes module.parent
  // undefined even though this isn't being run standalone). Importing the
  // actual implementation file directly skips that broken wrapper.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

export type OcrResult =
  | { ok: true; text: string }
  | { ok: false; reason: "scanned_pdf" };

/**
 * Routes an uploaded file to the right text-extraction path and honestly
 * flags scanned/image-only PDFs instead of silently sending near-empty
 * text to Claude and charging a credit for a garbage result.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    const text = await extractTextFromPdf(buffer);
    if (text.trim().length < MIN_USABLE_PDF_TEXT_LENGTH) {
      return { ok: false, reason: "scanned_pdf" };
    }
    return { ok: true, text };
  }

  // image/png, image/jpeg
  const text = await extractTextFromImage(buffer);
  return { ok: true, text };
}
