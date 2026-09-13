"use client";

import { useState } from "react";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        className="text-2xl leading-none px-1"
      >
        {open ? "×" : "☰"}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full bg-ivory border-b border-charcoal/15 flex flex-col px-8 py-4 gap-4 text-[15.5px] z-10">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
