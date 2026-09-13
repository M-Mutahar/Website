"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton({ googleConfigured = true }: { googleConfigured?: boolean }) {
  const { data: session, status } = useSession();
  const [showConfigNotice, setShowConfigNotice] = useState(false);

  if (status === "loading") {
    return <span className="text-sm text-charcoal/50">…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <a href="/dashboard" className="text-sm border-b border-charcoal pb-0.5">
          Dashboard
        </a>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm px-4 py-2 border border-charcoal bg-ivory"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          if (!googleConfigured) {
            setShowConfigNotice(true);
            return;
          }
          signIn("google", { callbackUrl: "/dashboard" });
        }}
        className="text-sm px-4 py-2 border border-charcoal bg-ivory"
      >
        Sign in with Google
      </button>
      {showConfigNotice && (
        <p className="text-xs text-venetian mt-2 absolute">Google sign-in is not configured yet.</p>
      )}
    </div>
  );
}
