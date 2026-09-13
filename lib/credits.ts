import { prisma } from "./prisma";
import { FREE_SIGNUP_CREDITS } from "./plans";

export class InsufficientCreditsError extends Error {}

/**
 * Grants the one-time signup bonus, exactly once, no matter how many times
 * or how concurrently this is called. The balance update and its ledger
 * entry are written in one transaction — if the process dies between them,
 * both roll back together, so the ledger can never be missing an entry for
 * a grant that already landed in the balance.
 *
 * Concurrency safety: `freeCreditsGranted: false` is part of the same
 * atomic UPDATE as the write, so only one of any simultaneous calls can
 * match it — no separate check-then-act step exists to race on.
 */
export async function grantFreeCreditsIfNeeded(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: userId, freeCreditsGranted: false },
      data: {
        freeCreditsGranted: true,
        creditsRemaining: { increment: FREE_SIGNUP_CREDITS },
      },
    });

    if (result.count === 1) {
      await tx.creditTransaction.create({
        data: { userId, amount: FREE_SIGNUP_CREDITS, type: "FREE_GRANT", description: "Signup bonus" },
      });
    }
  });
}

/**
 * Atomically deducts credits AND records the extraction result in one
 * transaction. This is deliberately one function, not two calls from the
 * route — if the extraction row fails to write (a transient DB issue)
 * after the balance was decremented, the whole transaction rolls back,
 * so the user is never left charged for a result that was never saved.
 *
 * The insufficient-balance case is signalled by throwing inside the
 * transaction (so the decrement itself never commits) and catching that
 * specific error outside it — distinct from a genuine DB failure, which
 * is rethrown so the caller returns a real error instead of a false
 * "out of credits" message.
 */
export async function consumeCreditsAndRecordExtraction(params: {
  userId: string;
  amount: number;
  tool: string;
  fileName: string;
  resultJson: string;
}): Promise<{ success: true } | { success: false }> {
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: params.userId, creditsRemaining: { gte: params.amount } },
        data: { creditsRemaining: { decrement: params.amount } },
      });

      if (result.count === 0) {
        throw new InsufficientCreditsError();
      }

      await tx.creditTransaction.create({
        data: {
          userId: params.userId,
          amount: -params.amount,
          type: "USAGE",
          description: `Used by ${params.tool}`,
        },
      });

      await tx.extraction.create({
        data: {
          userId: params.userId,
          tool: params.tool,
          fileName: params.fileName,
          status: "completed",
          creditsUsed: params.amount,
          resultJson: params.resultJson,
        },
      });
    });
    return { success: true };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { success: false };
    throw err; // a real DB failure — the caller should surface a real error, not "out of credits"
  }
}

/**
 * Grants purchased credits after a verified Stripe payment. Kept for any
 * call site that needs to grant credits outside the webhook's own inline
 * transaction. NOTE: unlike the webhook handler, this function does not
 * itself check Stripe-event idempotency — only call it from a path that
 * has already guaranteed the triggering event hasn't been processed
 * before (the webhook route enforces this via the StripeEvent unique
 * constraint; see app/api/stripe/webhook/route.ts).
 */
export async function grantPurchasedCredits(params: {
  userId: string;
  amount: number;
  description: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: { creditsRemaining: { increment: params.amount } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        type: "PURCHASE",
        description: params.description,
        stripeSessionId: params.stripeSessionId,
        stripePaymentIntentId: params.stripePaymentIntentId ?? undefined,
      },
    }),
  ]);
}
