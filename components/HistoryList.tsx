type HistoryItem = {
  id: string;
  fileName: string;
  status: string;
  creditsUsed: number;
  createdAt: Date;
};

export default function HistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-charcoal/50 mt-10">No extractions yet.</p>;
  }

  return (
    <div className="mt-12">
      <h2 className="text-sm font-mono text-charcoal/50 mb-3">recent activity</h2>
      <div className="border border-charcoal/15 bg-ivory divide-y divide-charcoal/10">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center px-4 py-3 text-sm">
            <span>{item.fileName}</span>
            <span className="font-mono text-xs text-charcoal/60">
              {item.status === "completed" ? `-${item.creditsUsed} credit` : "failed"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
