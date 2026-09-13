import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { PLANS, PlanId } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const planId = body?.planId as PlanId | undefined;

  // The client may only ever send a planId string. Price and credit
  // amount are looked up here, server-side, from lib/plans.ts — anything
  // else the client sends (a price, a credit count) is ignored entirely.
  if (!planId || !(planId in PLANS)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan.stripePriceEnvVar) {
    // "custom" has no Stripe price — it's the contact-us tier, handled in the UI.
    return NextResponse.json(
      { error: "This plan requires contacting us directly." },
      { status: 400 }
    );
  }

  const priceId = process.env[plan.stripePriceEnvVar];
  if (!priceId) {
    // Log the specific misconfiguration server-side only — the client
    // response stays generic so we don't hand out our env var naming
    // scheme to whoever hits this endpoint.
    console.error(`Stripe checkout misconfigured: missing ${plan.stripePriceEnvVar}`);
    return NextResponse.json(
      { error: "This plan is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }

  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment", // one-time purchase of a credit pack — never a subscription
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId, planId }, // only identifiers — the webhook re-looks-up price/credits itself
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?purchase=success`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard?purchase=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
