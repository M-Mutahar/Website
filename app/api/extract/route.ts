import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractInvoiceFromFile, ClaudeNotConfiguredError } from "@/lib/extract";
import { validateUploadedFile } from "@/lib/file-validation";
import { consumeCreditsAndRecordExtraction, grantFreeCreditsIfNeeded } from "@/lib/credits";
import { isRateLimited } from "@/lib/rate-limit";
import { tryAcquireInFlightLock, releaseInFlightLock } from "@/lib/concurrency-guard";
import { TOOLS } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOL_ID = "invoice_extractor" as const;

export async function POST(req: NextRequest) {
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

    if (user.creditsRemaining < cost) {
      return NextResponse.json(
        { success: false, error: "You don't have enough credits." },
        { status: 402 }
      );
    }

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

    // Send the validated file directly to Claude — no OCR step.
    let structured;
    try {
      structured = await extractInvoiceFromFile(buffer, file.type);
    } catch (err) {
      if (err instanceof ClaudeNotConfiguredError) {
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

    const outcome = await consumeCreditsAndRecordExtraction({
      userId,
      amount: cost,
      tool: TOOL_ID,
      fileName: file.name,
      resultJson: JSON.stringify(structured),
    });

    if (!outcome.success) {
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
  try {
    await prisma.extraction.create({
      data: { userId, tool: TOOL_ID, fileName, status: "failed", creditsUsed: 0, errorMessage },
    });
  } catch (err) {
    console.error("Failed to log a failed extraction (non-fatal):", err);
  }
}
