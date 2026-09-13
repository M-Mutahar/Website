// Every AI tool that spends credits registers itself here. This is the
// ONLY thing you need to add to when a future tool (receipt_extractor,
// bank_statement_extractor, etc.) gets built — the credit system, ledger,
// and usage history already work generically off `creditCost`.

export type ToolId = "invoice_extractor";

export const TOOLS: Record<ToolId, { label: string; creditCost: number }> = {
  invoice_extractor: {
    label: "Invoice → JSON",
    creditCost: 1,
  },
  // receipt_extractor: { label: "Receipt → JSON", creditCost: 1 },
  // bank_statement_extractor: { label: "Bank statement → JSON", creditCost: 3 },
};
