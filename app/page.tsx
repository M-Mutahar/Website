import AuthButton from "@/components/AuthButton";
import AuthAwareCTA from "@/components/AuthAwareCTA";
import MobileNav from "@/components/MobileNav";
import PricingTable from "@/components/PricingTable";
import { FREE_SIGNUP_CREDITS } from "@/lib/plans";

const SAMPLE_JSON = {
  invoice_number: "INV-1001",
  invoice_date: "2026-09-10",
  vendor: { name: "Example Company" },
  currency: "USD",
  total: 1250,
};

export default function Home() {
  // Server-side, non-secret config checks — only booleans ever reach the
  // client, never the actual credential values. This is what lets buttons
  // fail honestly instead of attempting an action that's guaranteed to break.
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";

  return (
    <main>
      <header className="border-b border-charcoal/15 relative">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-bold">
            <span className="w-6 h-6 rounded-full border-[1.5px] border-venetian text-venetian text-[11px] font-mono flex items-center justify-center -rotate-6">
              L
            </span>
            Ledgerline
          </div>
          <nav className="hidden md:flex gap-8 text-[15.5px]">
            <a href="#product" className="hover:border-b hover:border-charcoal">Product</a>
            <a href="#how" className="hover:border-b hover:border-charcoal">How It Works</a>
            <a href="#pricing" className="hover:border-b hover:border-charcoal">Pricing</a>
            <a href="#contact" className="hover:border-b hover:border-charcoal">Contact</a>
          </nav>
          <div className="flex items-center gap-4">
            <AuthButton googleConfigured={googleConfigured} />
            <MobileNav />
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 md:px-8 pt-16 md:pt-20 pb-16 grid md:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <h1 className="text-[36px] sm:text-[46px] md:text-[58px] leading-[1.05] font-semibold tracking-tight mb-6">
            Convert Invoices Into{" "}
            <em className="italic font-medium text-venetian">Clean JSON.</em>
          </h1>
          <p className="text-lg max-w-[46ch] text-charcoal/80 mb-8">
            Upload an invoice and automatically extract structured data
            including vendor information, invoice numbers, dates, totals,
            and line items.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <AuthAwareCTA
              label={`Try Free — ${FREE_SIGNUP_CREDITS} Credits`}
              googleConfigured={googleConfigured}
              className="bg-venetian text-ivory border border-venetian px-6 py-3.5 text-base hover:bg-[#833023]"
            />
            <a href="#how" className="text-base border-b border-charcoal pb-0.5">
              See How It Works
            </a>
          </div>
        </div>

        <div className="bg-ink-navy text-parchment p-6 font-mono text-[12.5px] shadow-xl">
          <div className="opacity-60 mb-3">extracted from INV-08841</div>
          <Row label="vendor.name" value="Alder & Finch Co." />
          <Row label="invoice_number" value="INV-08841" />
          <Row label="due_date" value="2026-10-02" />
          <Row label="subtotal" value="1240.00" />
          <div className="flex justify-between pt-2 font-bold text-[#D8B79C]">
            <span>total</span>
            <span>1339.20</span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="perf" />
      </div>

      {/* PRODUCT / DEMO */}
      <section id="product" className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <p className="text-charcoal/55 text-[14.5px] mb-3">the product</p>
        <h2 className="text-3xl md:text-4xl font-semibold mb-4 max-w-[24ch]">
          One upload in, one structured record out.
        </h2>
        <p className="text-charcoal/75 max-w-[58ch] mb-12">
          PDF, PNG, or JPG goes in. Claude reads the document directly
          and hands back clean structured JSON.
        </p>

        <div className="grid md:grid-cols-3 gap-6 items-center mb-12">
          <div className="border border-charcoal/20 bg-ivory p-6 text-center">
            <div className="font-mono text-sm text-charcoal/60 mb-2">step 1</div>
            <div className="font-semibold">Invoice</div>
            <div className="text-xs text-charcoal/50 mt-1">PDF · PNG · JPG</div>
          </div>
          <div className="border border-charcoal/20 bg-ivory p-6 text-center">
            <div className="font-mono text-sm text-charcoal/60 mb-2">step 2</div>
            <div className="font-semibold">AI Extraction</div>
            <div className="text-xs text-charcoal/50 mt-1">Claude AI</div>
          </div>
          <div className="border border-charcoal/20 bg-ivory p-6 text-center">
            <div className="font-mono text-sm text-charcoal/60 mb-2">step 3</div>
            <div className="font-semibold">Structured JSON</div>
            <div className="text-xs text-charcoal/50 mt-1">Copy or download</div>
          </div>
        </div>

        <div className="bg-ink-navy text-parchment p-6 font-mono text-[12.5px]">
          <div className="text-[11px] uppercase tracking-wide text-parchment/50 mb-3">
            Example output — not a live extraction
          </div>
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(SAMPLE_JSON, null, 2)}</pre>
        </div>

        <div className="mt-8">
          <AuthAwareCTA
            label="Try It Free"
            googleConfigured={googleConfigured}
            className="bg-venetian text-ivory border border-venetian px-6 py-3 text-base hover:bg-[#833023]"
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <p className="text-charcoal/55 text-[14.5px] mb-3">how it works</p>
        <h2 className="text-3xl md:text-4xl font-semibold mb-12 max-w-[20ch]">
          Three steps, start to finish.
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          <Step
            n="01"
            title="Upload Invoice"
            body="PDF, PNG, JPG, or JPEG, up to 4 MB."
          />
          <Step
            n="02"
            title="AI Extracts Data"
            body="Vendor, customer, invoice number, dates, currency, totals, taxes, and line items."
          />
          <Step
            n="03"
            title="Get Structured JSON"
            body="Copy it or download it as a .json file."
          />
        </div>
      </section>

      <section className="bg-ink-navy text-ivory py-20">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <p className="text-ivory/50 text-[14.5px] mb-3">how it's kept</p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 max-w-[22ch]">
            What we actually do with your data.
          </h2>
          <p className="text-ivory/75 max-w-[58ch] mb-11">
            No new password to manage, and no uploaded file is kept around
            longer than it takes to extract it.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <Seal title="Sign-in, not a new password" body="Authentication runs through Google OAuth — Ledgerline never sees or stores a password." />
            <Seal title="Files aren't retained" body="Your uploaded invoice is processed in memory for extraction and then discarded — only the extracted JSON result is saved to your account." />
            <Seal title="Payments handled by Stripe" body="Card details are entered on Stripe's checkout page and never touch Ledgerline's servers." />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <p className="text-charcoal/55 text-[14.5px] mb-3">plans</p>
        <h2 className="text-3xl md:text-4xl font-semibold mb-3">
          Priced by how much you process.
        </h2>
        <p className="text-charcoal/75 max-w-[58ch] mb-10">
          Every account starts with {FREE_SIGNUP_CREDITS} free credits after
          signing in. One invoice extraction uses one credit — buy more
          whenever you run out, no subscription.
        </p>
        <PricingTable googleConfigured={googleConfigured} stripeConfigured={stripeConfigured} />
      </section>

      {/* CONTACT */}
      <section id="contact" className="max-w-5xl mx-auto px-5 md:px-8 py-20 border-t border-charcoal/15">
        <p className="text-charcoal/55 text-[14.5px] mb-3">contact</p>
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">Contact Ledgerline</h2>
        <p className="text-charcoal/75 max-w-[58ch] mb-6">
          Have questions or need high-volume invoice processing?
        </p>
        {contactEmail ? (
          <a href={`mailto:${contactEmail}`} className="text-base border-b border-charcoal pb-0.5">
            {contactEmail}
          </a>
        ) : (
          <p className="text-charcoal/60 text-sm">Support contact is currently being set up.</p>
        )}
      </section>

      <footer className="bg-ink-navy text-ivory/65 py-12">
        <div className="max-w-5xl mx-auto px-5 md:px-8 flex justify-between items-end flex-wrap gap-5">
          <div className="text-ivory font-bold text-lg">Ledgerline</div>
          <div className="flex gap-6 text-sm">
            <a href="#product">Product</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-ivory/10">
      <span className="opacity-65">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-venetian text-sm mb-3">{n}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-charcoal/75 text-[15px]">{body}</p>
    </div>
  );
}

function Seal({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-ivory/20 pt-5">
      <h4 className="font-semibold mb-2">{title}</h4>
      <p className="text-ivory/70 text-[14.5px]">{body}</p>
    </div>
  );
}
