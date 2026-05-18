import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CohortPairProvider } from "@/components/cohorts/CohortPairProvider";
import { SwrProvider } from "@/components/providers/SwrProvider";
import { hasAppSession } from "@/lib/auth/passwordSession";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ok = await hasAppSession();
  if (!ok) redirect("/login");
  return (
    <SwrProvider>
      <CohortPairProvider>
        <AppShell>{children}</AppShell>
      </CohortPairProvider>
    </SwrProvider>
  );
}

