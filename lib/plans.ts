// Single source of truth for pricing. The server is the only thing that
// ever decides price/credits for a given plan id — the client can only
// send a planId string, never a price or credit amount (see the checkout
// route, which looks everything up from here and ignores anything else
// the client sends).

export type PlanId = "starter" | "pro" | "custom";

export const FREE_SIGNUP_CREDITS = 3;

export const PLANS: Record<
  PlanId,
  {
    name: string;
    credits: number;
    priceUsd: number | null; // null = "contact us", no Stripe price exists
    stripePriceEnvVar: string | null;
  }
> = {
  starter: {
    name: "Starter",
    credits: 100,
    priceUsd: 10,
    stripePriceEnvVar: "STRIPE_PRICE_STARTER",
  },
  pro: {
    name: "Pro",
    credits: 500,
    priceUsd: 25,
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
  },
  custom: {
    name: "Custom",
    credits: 0,
    priceUsd: null,
    stripePriceEnvVar: null,
  },
};
