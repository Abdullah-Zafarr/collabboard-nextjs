import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { WorkspaceDashboard } from "@/components/workspace-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <main className="min-h-screen bg-[#f7f9f8]">
      <AppHeader email={user.email ?? "Signed in"} />
      <WorkspaceDashboard userId={user.id} />
    </main>
  );
}

