import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardView } from "@/components/board-view";
import { toWorkspaceSlug } from "@/lib/utils";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, owner_id")
    .order("created_at", { ascending: false });
  const workspace = workspaces?.find(
    (item) => item.id === id || toWorkspaceSlug(item.name) === id,
  );
  if (!workspace) notFound();
  if (id === workspace.id) redirect(`/board/${toWorkspaceSlug(workspace.name)}`);
  return <BoardView workspace={workspace} user={{ id: user.id, email: user.email ?? "" }} />;
}
