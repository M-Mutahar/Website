import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PLANS, PlanId } from "@/lib/plans";
import Stripe from "stripe";

export const runtime = "nodejs"; // needs the raw body for signature verification

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    // Log the real reason server-side only — the public response stays
    // generic. This endpoint is internet-facing and unauthenticated by
    // design (Stripe can't sign in), so anything more specific than "no"
    // here is free reconnaissance for whoever is probing it.
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;

    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const userId = checkoutSession.metadata?.userId;
    const planId = checkoutSession.metadata?.planId as PlanId | undefined;

    if (userId && planId && PLANS[planId]) {
      const plan = PLANS[planId];
      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;

      try {
        // Insert the event record and grant credits in ONE transaction.
        // The StripeEvent.eventId unique constraint is what actually
        // prevents double-crediting: if this event was already processed,
        // the create() below throws a unique-constraint error (P2002) and
        // the whole transaction rolls back — including the credit grant.
        // This closes the race a "check if processed, then act" approach
        // would leave open between two near-simultaneous webhook deliveries.
        await prisma.$transaction([
          prisma.stripeEvent.create({ data: { eventId: event.id, type: event.type } }),
          prisma.user.update({
            where: { id: userId },
            data: { creditsRemaining: { increment: plan.credits } },
          }),
          prisma.creditTransaction.create({
            data: {
              userId,
              amount: plan.credits,
              type: "PURCHASE",
              description: `${plan.name} pack`,
              stripeSessionId: checkoutSession.id,
              stripePaymentIntentId: paymentIntentId,
            },
          }),
        ]);
      } catch (err: any) {
        if (err.code === "P2002") {
          // Already processed this exact event — a Stripe retry. No-op.
          return NextResponse.json({ received: true });
        }
        throw err;
      }
    }
  }

  return NextResponse.json({ received: true });
}
