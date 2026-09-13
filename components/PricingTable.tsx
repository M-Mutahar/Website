"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PLANS, PlanId, FREE_SIGNUP_CREDITS } from "@/lib/plans";

export default function PricingTable({
  googleConfigured,
  stripeConfigured,
}: {
  googleConfigured: boolean;
  stripeConfigured: boolean;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  function handleFree() {
    if (session?.user) {
      router.push("/dashboard");
      return;
    }
    if (!googleConfigured) {
      setNotice("Google sign-in is not configured yet.");
      return;
    }
    signIn("google", { callbackUrl: "/dashboard" });
  }

  async function handlePaid(planId: PlanId) {
    setNotice(null);
    if (!session?.user) {
      if (!googleConfigured) {
        setNotice("Google sign-in is not configured yet.");
        return;
      }
      signIn("google", { callbackUrl: "/#pricing" });
      return;
    }
    if (!stripeConfigured) {
      setNotice("Payments aren't configured yet in this environment — Stripe checkout is unavailable for now.");
      return;
    }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setNotice(data.error || "Something went wrong starting checkout.");
  }

  function handleCustom() {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  const cards: {
    id: PlanId | "free";
    name: string;
    credits: string;
    price: string;
    buttonLabel: string;
    onClick: () => void;
  }[] = [
    { id: "free", name: "Free", credits: `${FREE_SIGNUP_CREDITS} credits`, price: "$0", buttonLabel: "Try Free", onClick: handleFree },
    { id: "starter", name: PLANS.starter.name, credits: `${PLANS.starter.credits} credits`, price: `$${PLANS.starter.priceUsd}`, buttonLabel: "Buy 100 Credits", onClick: () => handlePaid("starter") },
    { id: "pro", name: PLANS.pro.name, credits: `${PLANS.pro.credits} credits`, price: `$${PLANS.pro.priceUsd}`, buttonLabel: "Buy 500 Credits", onClick: () => handlePaid("pro") },
    { id: "custom", name: "Custom", credits: "500+ credits", price: "Custom", buttonLabel: "Contact Us", onClick: handleCustom },
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => (
          <div key={card.id} className="border border-charcoal/20 bg-ivory p-6 flex flex-col">
            <div className="text-lg font-semibold mb-1">{card.name}</div>
            <div className="font-mono text-2xl mb-1">{card.price}</div>
            <div className="text-sm text-charcoal/60 mb-6">{card.credits}</div>
            <button
              onClick={card.onClick}
              className="mt-auto text-sm border border-charcoal px-4 py-2.5 hover:bg-charcoal hover:text-ivory transition-colors"
            >
              {card.buttonLabel}
            </button>
          </div>
        ))}
      </div>
      {notice && <p className="text-sm text-venetian mt-5">{notice}</p>}
    </div>
  );
}
