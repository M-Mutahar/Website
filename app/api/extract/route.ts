import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/ocr";
import { extractInvoiceFromText, ClaudeNotConfiguredError } from "@/lib/extract";
import { validateUploadedFile } from "@/lib/file-validation";
import { consumeCreditsAndRecordExtraction, grantFreeCreditsIfNeeded } from "@/lib/credits";
import { isRateLimited } from "@/lib/rate-limit";
import { tryAcquireInFlightLock, releaseInFlightLock } from "@/lib/concurrency-guard";
import { TOOLS } from "@/lib/tools";

export const runtime = "nodejs"; // tesseract.js/pdf-parse are Node-only, not Edge-compatible
export const maxDuration = 60; // OCR + Claude can take longer than the 10s default on some plans

const TOOL_ID = "invoice_extractor" as const;

export async function POST(req: NextRequest) {
  // 1. Auth — checked independently here, not just via middleware. This
  // route must be safe even if middleware config is ever wrong.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Please sign in to continue." },
      { status: 401 }
    );
  }
  const userId = (session.user as any).id as string;

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  // KNOWN MVP LIMITATION (see lib/concurrency-guard.ts): OCR and the Claude
  // call both happen before the atomic credit deduction further down. Two
  // truly simultaneous requests from the same user can both pay the
  // OCR/Claude cost before the deduction rejects the loser — the ledger
  // itself stays correct (no double-spend, no negative balance), but the
  // app can be made to pay for wasted model calls. A full fix needs a
  // reservation that survives a mid-flight function timeout (a TTL +
  // sweep job, or similar), which is real added infrastructure, not a
  // clean MVP-sized change — a naive decrement-up-front would trade
  // today's safe failure mode (a crash never overcharges) for a worse one
  // (a crash can silently strand a spent credit). This in-memory lock
  // closes the common case cheaply instead; see the file for its limits.
  if (!tryAcquireInFlightLock(userId)) {
    return NextResponse.json(
      { success: false, error: "Another extraction is already in progress. Please wait for it to finish." },
      { status: 429 }
    );
  }

  try {
    await grantFreeCreditsIfNeeded(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    }

    const cost = TOOLS[TOOL_ID].creditCost;

    // 2. Cheap early rejection before doing any OCR/Claude work if the
    // balance is already visibly insufficient. This is a courtesy check —
    // the AUTHORITATIVE check is the atomic consumeCreditsAndRecordExtraction() call below.
    if (user.creditsRemaining < cost) {
      return NextResponse.json(
        { success: false, error: "You don't have enough credits." },
        { status: 402 }
      );
    }

    // 3. Read and validate the file.
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateUploadedFile(file.type, file.size, buffer);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // 4. OCR. Scanned PDFs are flagged honestly instead of silently
    // extracting near-nothing and charging for it.
    let rawText: string;
    try {
      const ocrResult = await extractText(buffer, file.type);
      if (!ocrResult.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This PDF appears to be scanned or image-based. Scanned PDF support is currently limited.",
          },
          { status: 422 }
        );
      }
      rawText = ocrResult.text;
    } catch (err) {
      await logFailedExtraction(userId, file.name, "OCR failed");
      return NextResponse.json(
        { success: false, error: "Couldn't read this file. Your credit was not used." },
        { status: 500 }
      );
    }

    // 5. Claude extraction. No credit is deducted anywhere above this line
    // or in this catch block — only after a validated success below.
    let structured;
    try {
      structured = await extractInvoiceFromText(rawText);
    } catch (err) {
      if (err instanceof ClaudeNotConfiguredError) {
        // Don't log this as a failed extraction and don't touch credits —
        // this is a deployment configuration state, not a usage event.
        return NextResponse.json(
          { success: false, error: "Invoice extraction is currently being configured." },
          { status: 503 }
        );
      }
      await logFailedExtraction(userId, file.name, "Extraction failed");
      return NextResponse.json(
        { success: false, error: "Invoice extraction failed. Your credit was not used." },
        { status: 500 }
      );
    }

    // 6. Only now — after a fully successful, validated extraction — attempt
    // the atomic deduction. This call also writes the result row in the SAME
    // database transaction as the deduction (see lib/credits.ts): if saving
    // the result fails for any reason, the deduction rolls back with it, so
    // a DB hiccup here can never leave the user charged for a lost result.
    const outcome = await consumeCreditsAndRecordExtraction({
      userId,
      amount: cost,
      tool: TOOL_ID,
      fileName: file.name,
      resultJson: JSON.stringify(structured),
    });

    if (!outcome.success) {
      // Extraction succeeded but the balance hit zero in the meantime (a
      // concurrent request — from a DIFFERENT user, or a retried request
      // after a prior timeout — won the race for the last credit). The
      // user is not charged and not left with a negative balance — they
      // just don't get this particular result for free.
      return NextResponse.json(
        { success: false, error: "You don't have enough credits." },
        { status: 402 }
      );
    }

    const refreshed = await prisma.user.findUnique({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      data: structured,
      creditsRemaining: refreshed?.creditsRemaining ?? 0,
    });
  } finally {
    releaseInFlightLock(userId);
  }
}

async function logFailedExtraction(userId: string, fileName: string, errorMessage: string) {
  // Best-effort only. If this write itself fails (DB down, pool exhausted,
  // etc.), we must not let that failure escape and override the real
  // extraction error the caller is already returning to the user — a
  // logging problem should never turn a clean "OCR failed" response into
  // an unhandled 500. Swallow and log server-side instead.
  try {
    await prisma.extraction.create({
      data: { userId, tool: TOOL_ID, fileName, status: "failed", creditsUsed: 0, errorMessage },
    });
  } catch (err) {
    console.error("Failed to log a failed extraction (non-fatal):", err);
  }
}
