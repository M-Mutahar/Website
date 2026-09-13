// Calls the Claude API to turn raw invoice text into structured JSON.
// Uses Haiku deliberately — this task is well-specified extraction, not
// open-ended reasoning, so the cheaper model is the right cost/quality
// tradeoff here. See product-self-knowledge for current model strings if
// this ever needs to change.

export type ExtractedInvoice = {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  vendor: { name: string | null; address: string | null; tax_id: string | null };
  customer: { name: string | null; address: string | null };
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  total: number | null;
  line_items: { description: string | null; quantity: number | null; unit_price: number | null; total: number | null }[];
};

// Thrown specifically when the Claude API key is missing, so the route can
// tell this apart from a genuine extraction failure and show an honest
// "still being configured" message instead of a generic error.
export class ClaudeNotConfiguredError extends Error {}

const SYSTEM_PROMPT = `Extract invoice data from the text below. Respond with ONLY a JSON object, no markdown fences, no commentary, matching exactly this shape:
{"invoice_number":null,"invoice_date":null,"due_date":null,"vendor":{"name":null,"address":null,"tax_id":null},"customer":{"name":null,"address":null},"currency":null,"subtotal":null,"tax":null,"discount":null,"total":null,"line_items":[{"description":null,"quantity":null,"unit_price":null,"total":null}]}
Rules: use null for anything not clearly present. Never invent or estimate a value. Preserve every line item found. Amounts are numbers, not strings.`;

export async function extractInvoiceFromText(rawText: string): Promise<ExtractedInvoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeNotConfiguredError("ANTHROPIC_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawText }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((c: any) => c.type === "text");
  if (!textBlock) throw new Error("No text response from model");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!isValidExtractionShape(parsed)) {
    throw new Error("Model response did not match the expected invoice schema");
  }

  return parsed as ExtractedInvoice;
}

// A light structural check, not a full JSON-schema library — this is
// exactly the kind of "don't overengineer" tradeoff worth making for an
// MVP: it catches a malformed/truncated response without adding a
// dependency for something this simple.
function isValidExtractionShape(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  const requiredTopLevel = [
    "invoice_number", "invoice_date", "due_date", "vendor", "customer",
    "currency", "subtotal", "tax", "discount", "total", "line_items",
  ];
  if (!requiredTopLevel.every((key) => key in value)) return false;
  if (typeof value.vendor !== "object" || value.vendor === null) return false;
  if (typeof value.customer !== "object" || value.customer === null) return false;
  if (!Array.isArray(value.line_items)) return false;
  return true;
}
