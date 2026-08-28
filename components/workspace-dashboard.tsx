"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Coins, LayoutGrid, Plus, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toWorkspaceSlug } from "@/lib/utils";

type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

type DashboardActivity = {
  id: number;
  workspace_id: string;
  action: string;
  entity_type: string;
  metadata: { title?: string; name?: string; email?: string };
  created_at: string;
};

const WORKSPACE_COST = 25;

export function WorkspaceDashboard({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [recentActivity, setRecentActivity] = useState<DashboardActivity[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const [workspaceResult, creditResult, activityResult] = await Promise.all([
      supabase
        .from("workspaces")
        .select("id, name, owner_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("credits")
        .select("credits_count")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("activity_logs")
        .select("id, workspace_id, action, entity_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (workspaceResult.error) setError(workspaceResult.error.message);
    else setWorkspaces(workspaceResult.data ?? []);

    if (creditResult.error) setError(creditResult.error.message);
    else setCredits(creditResult.data?.credits_count ?? 0);

    if (activityResult.error) setError(activityResult.error.message);
    else setRecentActivity((activityResult.data ?? []) as DashboardActivity[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || credits === null) return;
    if (credits < WORKSPACE_COST) {
      setError(`You need ${WORKSPACE_COST} credits to create a workspace.`);
      return;
    }

    setCreating(true);
    setError(null);
    const workspaceName = name.trim();
    const { error } = await supabase.rpc("create_workspace", {
      workspace_name: workspaceName,
    });

    if (error) {
      setError(error.message);
      setCreating(false);
      void loadDashboard();
      return;
    }

    setCredits((current) => current === null ? current : current - WORKSPACE_COST);
    router.push(`/board/${toWorkspaceSlug(workspaceName)}`);
  }

  async function deleteWorkspace(workspace: Workspace) {
    const confirmed = window.confirm(
      `Delete "${workspace.name}"? All tasks, comments, and workspace activity will be permanently removed. Credits are not refunded.`,
    );
    if (!confirmed) return;

    setDeletingId(workspace.id);
    setError(null);
    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);

    if (error) setError(error.message);
    else {
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
      setRecentActivity((current) => current.filter((item) => item.workspace_id !== workspace.id));
    }
    setDeletingId(null);
  }

  const canCreateWorkspace = credits !== null && credits >= WORKSPACE_COST;

  function activityLabel(item: DashboardActivity) {
    const subject = item.metadata.title ?? item.metadata.name ?? item.metadata.email ?? item.entity_type;
    const verbs: Record<string, string> = {
      created: "Created",
      updated: "Updated",
      moved: "Moved",
      commented: "Commented on",
      invited: "Invited",
    };
    return `${verbs[item.action] ?? item.action} ${subject}`;
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-12 lg:px-8">
      <div className="grid items-start gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">Your workspaces</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-slate-950">Where will we make progress?</h1>
        <p className="mt-3 text-slate-500">Open a shared board or start a fresh project.</p>
        <p className="mt-2 text-sm text-slate-600">Credits: <span className="font-semibold text-slate-900">{credits ?? "--"}</span></p>
      </div>

      <form onSubmit={createWorkspace} className="mt-10 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New workspace name"
            maxLength={80}
            className="min-w-0 flex-1 rounded-xl px-4 py-3 text-base outline-none placeholder:text-slate-400"
          />
          <button disabled={creating || !name.trim() || !canCreateWorkspace} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="size-4" />
            {creating ? "Creating..." : `Create · ${WORKSPACE_COST}`}
            {!creating && <Coins className="size-3.5" />}
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-400">A workspace costs {WORKSPACE_COST} credits and includes three starter columns.</p>
      </form>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="mt-12 h-40 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : workspaces.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><LayoutGrid /></span>
          <h2 className="mt-5 text-xl font-bold">Your first board is one name away</h2>
          <p className="mt-2 text-sm text-slate-500">Create a workspace above. We&apos;ll add three useful columns automatically.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {workspaces.map((workspace, index) => {
            const isOwner = workspace.owner_id === userId;
            return (
              <article key={workspace.id} className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
                <Link href={`/board/${toWorkspaceSlug(workspace.name)}`} aria-label={`Open ${workspace.name}`} className="absolute inset-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
                <div className="pointer-events-none flex items-start justify-between">
                  <span className={`grid size-12 place-items-center rounded-2xl text-white ${["bg-emerald-500", "bg-violet-500", "bg-sky-500"][index % 3]}`}><LayoutGrid className="size-5" /></span>
                  <div className="flex items-center gap-2">
                    {isOwner && (
                      <button type="button" disabled={deletingId === workspace.id} onClick={() => void deleteWorkspace(workspace)} aria-label={`Delete ${workspace.name}`} className="pointer-events-auto relative z-10 grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <ArrowRight className="size-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-500" />
                  </div>
                </div>
                <h2 className="pointer-events-none mt-6 text-xl font-bold">{workspace.name}</h2>
                <div className="pointer-events-none mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><Users className="size-3.5" /> Shared workspace</span>
                  <span>{isOwner ? "Owner" : "Member"}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </section>

      <aside className="border-t border-slate-200 pt-7 xl:mt-1 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
        <h2 className="text-sm font-bold text-slate-900">Recent activity</h2>
        <p className="mt-1 text-xs text-slate-500">Latest changes across your workspaces.</p>
        {loading ? (
          <div className="mt-6 space-y-5">
            {[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-200/60" />)}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ol className="mt-5 divide-y divide-slate-200">
            {recentActivity.map((item) => {
              const workspace = workspaces.find((entry) => entry.id === item.workspace_id);
              const row = (
                <>
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-700">{activityLabel(item)}</p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span className="truncate">{workspace?.name ?? "Workspace"}</span>
                    <time className="shrink-0" dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
                  </div>
                </>
              );
              return (
                <li key={item.id} className="py-4 first:pt-0">
                  {workspace ? <Link href={`/board/${toWorkspaceSlug(workspace.name)}`} className="block hover:text-emerald-700">{row}</Link> : row}
                </li>
              );
            })}
          </ol>
        )}
      </aside>
      </div>
    </div>
  );
}
