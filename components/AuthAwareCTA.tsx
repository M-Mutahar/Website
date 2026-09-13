"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthAwareCTA({
  label,
  googleConfigured,
  className,
}: {
  label: string;
  googleConfigured: boolean;
  className: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showConfigNotice, setShowConfigNotice] = useState(false);

  function handleClick() {
    if (session?.user) {
      router.push("/dashboard");
      return;
    }
    if (!googleConfigured) {
      // Don't attempt a sign-in that's guaranteed to fail — tell the truth
      // instead of letting NextAuth surface its own generic error page.
      setShowConfigNotice(true);
      return;
    }
    signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div>
      <button onClick={handleClick} disabled={status === "loading"} className={className}>
        {label}
      </button>
      {showConfigNotice && (
        <p className="text-sm text-venetian mt-3">
          Google sign-in is not configured yet.
        </p>
      )}
    </div>
  );
}
