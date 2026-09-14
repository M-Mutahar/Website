"use client";

import { useState } from "react";
import type { ExtractedInvoice } from "@/lib/extract";

// These labels are cosmetic, not tied to real server-sent progress events —
// the backend does one request. They're ordered to match the ACTUAL
// sequence the server executes (upload → Claude reads file → persist), so
// they're an honest approximation of what's happening, not a fake animation.
const STAGES = ["Uploading invoice…", "Reading document…", "Extracting invoice data…", "Creating JSON…"];

export default function UploadForm({ creditsRemaining }: { creditsRemaining: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<ExtractedInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(creditsRemaining);
  const [copied, setCopied] = useState(false);

  const outOfCredits = credits <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setStageIndex(0);

    const stageTimer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 900);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Extraction failed.");
        if (typeof data.creditsRemaining === "number") setCredits(data.creditsRemaining);
        return;
      }
      setResult(data.data);
      setCredits(data.creditsRemaining);
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      clearInterval(stageTimer);
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name || "invoice").replace(/\.[^.]+$/, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="font-mono text-sm mb-6 text-charcoal/70">
        {credits} Credit{credits === 1 ? "" : "s"} Remaining
      </div>

      {outOfCredits ? (
        <div className="border border-venetian bg-ivory p-6">
          <p className="mb-3">You have no credits remaining.</p>
          <a
            href="/#pricing"
            className="inline-block text-sm border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-ivory transition-colors"
          >
            Buy Credits
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border border-charcoal/20 bg-ivory p-6">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mb-4 block text-sm w-full"
          />
          <p className="text-xs text-charcoal/50 mb-4">PDF, PNG, or JPG — up to 4 MB.</p>
          <button
            type="submit"
            disabled={!file || loading}
            className="w-full sm:w-auto bg-venetian text-ivory px-6 py-2.5 text-sm disabled:opacity-40"
          >
            {loading ? STAGES[stageIndex] : "Extract Invoice"}
          </button>
        </form>
      )}

      {error && <p className="mt-5 text-venetian text-sm">{error}</p>}

      {result && (
        <div className="mt-8">
          <p className="text-sm font-semibold mb-3">Extraction Complete</p>
          <div className="flex gap-3 mb-3">
            <button onClick={handleCopy} className="text-sm border-b border-charcoal pb-0.5">
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button onClick={handleDownload} className="text-sm border-b border-charcoal pb-0.5">
              Download JSON
            </button>
          </div>
          <pre className="bg-ink-navy text-parchment p-6 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap break-words">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
