import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UploadForm from "@/components/UploadForm";
import AuthButton from "@/components/AuthButton";
import HistoryList from "@/components/HistoryList";

export default async function Dashboard() {
  // Server-side check — this page never renders its contents for a
  // signed-out user, independent of the middleware matcher.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/");

  const history = await prisma.extraction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, fileName: true, status: true, creditsUsed: true, createdAt: true },
  });

  return (
    <main className="max-w-3xl mx-auto px-5 md:px-8 py-14">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-2.5 text-xl font-bold">
          <span className="w-6 h-6 rounded-full border-[1.5px] border-venetian text-venetian text-[11px] font-mono flex items-center justify-center -rotate-6">
            L
          </span>
          Ledgerline
        </div>
        <nav className="flex items-center gap-5">
          <a href="/#pricing" className="text-sm border-b border-charcoal pb-0.5">
            Pricing
          </a>
          <AuthButton />
        </nav>
      </div>

      <h1 className="text-3xl font-semibold mb-10">
        Hello{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
      </h1>

      <UploadForm creditsRemaining={user.creditsRemaining} />
      <HistoryList items={history} />
    </main>
  );
}
