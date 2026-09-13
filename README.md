# Ledgerline

An invoice-extraction SaaS on a universal credit system: Google sign-in, a shared credit wallet, and Stripe-billed credit packs, architected so future extraction tools (receipts, bank statements, etc.) can plug into the same wallet.

## What Ledgerline does

Sign in with Google → get free credits → upload an invoice (PDF/PNG/JPG) → get back structured JSON (vendor, dates, totals, line items) → copy or download it → buy more credits when you run out. No subscription — credits don't expire or reset monthly.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL · NextAuth.js (Google OAuth) · Stripe Checkout (one-time payments) · Claude API (Haiku) for extraction · tesseract.js / pdf-parse for OCR.

## Architecture

- **Credit wallet** (`User.creditsRemaining`) — one balance per user, shared across all future tools.
- **Credit ledger** (`CreditTransaction`) — every grant, purchase, and usage deduction writes one row here. The wallet balance is the current total; this table is the full history.
- **Atomic credit operations** (`lib/credits.ts`) — `grantFreeCreditsIfNeeded` and `consumeCredits` both use a single conditional `UPDATE ... WHERE` statement so the check and the write can't be split by a race. See the comments in that file for the exact mechanics.
- **Tool registry** (`lib/tools.ts`) — each AI tool declares its `creditCost` here. `invoice_extractor` is the only one built; adding a future tool means adding one entry, not new tables.
- **Stripe idempotency** (`StripeEvent`) — the webhook inserts the event ID and grants credits in one transaction; a duplicate delivery hits the table's unique constraint and rolls back harmlessly.
- **Pricing config** (`lib/plans.ts`) — the only place price/credit numbers live. The client sends a `planId` string only; the server looks up price and credits itself.

## Setup

```bash
npm install
cp .env.example .env   # fill in every value — see comments in the file
npx prisma db push     # creates the tables (see migration note in schema.prisma)
npm run dev
```

### Google OAuth
1. https://console.cloud.google.com/apis/credentials → Create OAuth client ID → Web application.
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (swap the domain in production).
3. Copy the client ID/secret into `.env`.

### PostgreSQL
Any hosted Postgres works — Supabase and Neon both have free tiers that are enough for an MVP. Put the connection string in `DATABASE_URL`.

### Prisma
`npx prisma db push` creates the tables from `prisma/schema.prisma`. Use `npx prisma studio` to browse data locally.

### Claude API
Get a key from the Anthropic Console, put it in `ANTHROPIC_API_KEY`. Extraction runs on `claude-haiku-4-5-20251001` — cheaper than Sonnet and sufficient for this well-specified a task.

### Stripe (test mode)
1. Create two **one-time** Prices in the Stripe dashboard (not subscriptions): $10 and $25.
2. Paste their price IDs into `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`.
3. For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, copy the printed webhook secret into `STRIPE_WEBHOOK_SECRET`.
4. For production: add the endpoint in the Stripe dashboard and use its signing secret instead.

## Testing checklist

**Auth**
- [ ] New user signs in → receives exactly 3 free credits
- [ ] User signs out, signs back in → credit balance unchanged (no second grant)

**Extraction**
- [ ] JPG invoice extracts correctly
- [ ] PNG invoice extracts correctly
- [ ] Text-based PDF extracts correctly
- [ ] Scanned/image-only PDF returns the honest "scanned PDF" message, no credit charged
- [ ] Invalid file type is rejected
- [ ] Oversized file (>4MB) is rejected
- [ ] A file with a `.pdf` name but non-PDF bytes is rejected (magic-byte check)
- [ ] A forced Claude/OCR failure does not deduct a credit
- [ ] A successful extraction deducts exactly 1 credit

**Concurrency**
- [ ] User with 1 credit fires two extraction requests at once → only one succeeds, balance never goes negative

**Payments**
- [ ] Stripe test checkout completes → credits appear on the dashboard
- [ ] Re-sending the same webhook event (Stripe CLI: `stripe events resend <id>`) does not add credits twice
- [ ] Cancelled checkout grants nothing

**UI**
- [ ] Copy JSON copies valid JSON and shows confirmation
- [ ] Download JSON produces a valid `.json` file
- [ ] Recent activity list updates after an extraction

## Known limitations

- **File size cap is 4 MB, not 10 MB** — Vercel Functions have a hard 4.5 MB request-body limit (confirmed against Vercel's own docs as of Nov 2025). A higher stated limit would just 413 in production. If you deploy somewhere without that constraint, `lib/file-validation.ts` is the one place to raise it.
- **OCR/Claude cost can be spent by a losing concurrent request** — the atomic credit deduction happens after OCR + Claude run, so two truly simultaneous requests from the same user can both incur model cost before one is rejected. The credit ledger itself stays correct (no double-spend, no negative balance) — this is a cost-control gap, not a financial-integrity one. Mitigated by an in-memory per-user lock (`lib/concurrency-guard.ts`) that catches the common single-instance case; it won't stop two requests landing on different Vercel instances. A full fix needs a reservation that survives a mid-flight function timeout (a TTL + sweep job or similar) — real infrastructure, deliberately not built for this MVP since a naive version would trade today's safe failure mode (a crash never overcharges) for a worse one (a crash could silently strand a spent credit).
- **OCR quality**: `tesseract.js` is free and works, but is slower/less accurate than a paid OCR API (Google Vision, AWS Textract). Swap it in `lib/ocr.ts` if accuracy on real invoices isn't good enough. It's also a known source of Vercel bundling quirks (worker/wasm asset resolution) — `tesseract.js` and `pdf-parse` are marked external in `next.config.mjs` to avoid the most common failure mode, but verify with a real deploy before launch, not just `npm run build` locally.
- **`pdf-parse` is imported via its internal `lib/pdf-parse.js` path, not the package root** — the package root (`index.js`) has a well-documented debug-mode block that crashes with `ENOENT` reading a hardcoded test file whenever `module.parent` is undefined, which webpack/serverless bundling triggers. Don't "simplify" this back to `import("pdf-parse")` — that reintroduces the crash.
- **Scanned PDFs are not supported** — a PDF with no real text layer is detected and returns a clear error rather than a bad guess. Adding support means rasterizing pages to images and routing through the image OCR path; not built yet.
- **Rate limiting is best-effort, not bulletproof**: the limiter in `lib/rate-limit.ts` is in-memory. On Vercel, serverless functions don't share memory across instances and a cold start clears it — it stops casual abuse on a warm instance, not a determined distributed attacker. Add Upstash Redis's rate-limit package if you need a real guarantee; it's a small addition, not a rearchitecture.
- **No DB-level floor on the credit balance** — `creditsRemaining` can't go negative through any code path in this app today (enforced by the atomic conditional update in `lib/credits.ts`), but there's no Postgres `CHECK (creditsRemaining >= 0)` constraint backing that up. Worth adding as a raw-SQL migration before you have real money flowing through this, as defense-in-depth against a future bug bypassing the app-level guard.
- **`grantPurchasedCredits` in `lib/credits.ts` is currently unused** — the webhook grants credits via its own inline transaction (which also handles Stripe-event idempotency). Don't wire up `grantPurchasedCredits` to a new call site without also giving it the same idempotency guarantee the webhook has.
- **No admin dashboard, refund UI, or plan-expiry logic** — purchased credits never expire and stack indefinitely by design (matches "not a subscription"). Deliberately left out per the MVP scope.
- **No terms of service or privacy policy page** — required before taking real payments from the public; not something code can generate for you.

## Deploying

Vercel is the path of least resistance for the app itself. You'll need a separately-hosted Postgres (Supabase/Neon) since Vercel doesn't host databases. The Stripe webhook route uses the Node.js runtime (needs the raw request body for signature verification) — already set via `export const runtime = "nodejs"` in that route, no extra config needed.
