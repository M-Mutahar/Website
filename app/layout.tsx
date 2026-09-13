import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Ledgerline — Invoice extraction that reads paper like a person",
  description:
    "Turn scanned invoices, PDFs, and photos into clean structured data. Sign in with Google, no templates required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-serif text-charcoal">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
