"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Workspace = { id: string; name: string; owner_id: string; created_at: string };

export function WorkspaceDashboard({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    const { data, error } = await supabase.from("workspaces").select("id, name, owner_id, created_at").order("created_at", { ascending: false });
    if (error) setError(error.message); else setWorkspaces(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadWorkspaces(); }, [loadWorkspaces]);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim()) return;
    setCreating(true); setError(null);
    const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name.trim() });
    if (error) { setError(error.message); setCreating(false); return; }
    router.push(`/board/${data}`);
  }

  return <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
    <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">Your workspaces</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-slate-950">Where will we make progress?</h1><p className="mt-3 text-slate-500">Open a shared board or start a fresh project.</p></div>
    <form onSubmit={createWorkspace} className="mt-10 flex max-w-2xl gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New workspace name" maxLength={80} className="min-w-0 flex-1 rounded-xl px-3 text-sm outline-none placeholder:text-slate-400" /><button disabled={creating || !name.trim()} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"><Plus className="size-4" />{creating ? "Creating…" : "Create"}</button></form>
    {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    {loading ? <div className="mt-12 h-40 animate-pulse rounded-3xl bg-slate-200/60" /> : workspaces.length === 0 ? <div className="mt-12 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><LayoutGrid /></span><h2 className="mt-5 text-xl font-bold">Your first board is one name away</h2><p className="mt-2 text-sm text-slate-500">Create a workspace above. We’ll add three useful columns automatically.</p></div> : <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{workspaces.map((workspace, index) => <Link key={workspace.id} href={`/board/${workspace.id}`} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl"><div className="flex items-start justify-between"><span className={`grid size-12 place-items-center rounded-2xl text-white ${['bg-emerald-500','bg-violet-500','bg-sky-500'][index % 3]}`}><LayoutGrid className="size-5" /></span><ArrowRight className="size-5 text-slate-300 group-hover:text-emerald-500" /></div><h2 className="mt-6 text-xl font-bold">{workspace.name}</h2><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400"><span className="flex items-center gap-1.5"><Users className="size-3.5" /> Shared workspace</span><span>{workspace.owner_id === userId ? "Owner" : "Member"}</span></div></Link>)}</div>}
  </div>;
}

