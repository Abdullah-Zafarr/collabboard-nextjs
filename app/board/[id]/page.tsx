import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardView } from "@/components/board-view";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: workspace } = await supabase.from("workspaces").select("id, name, owner_id").eq("id", id).single();
  if (!workspace) notFound();
  return <BoardView workspace={workspace} user={{ id: user.id, email: user.email ?? "" }} />;
}

