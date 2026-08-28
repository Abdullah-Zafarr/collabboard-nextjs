"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon, ArrowLeft, CalendarDays, Check, ChevronRight,
  CircleUserRound, Clock3, GripVertical, LayoutDashboard, MessageSquare,
  Paperclip, Plus, Send, Trash2, Upload, UserPlus, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Activity, BoardColumn, Member, Priority, Task } from "@/lib/board-types";

type Workspace = { id: string; name: string; owner_id: string };
type Comment = { id: string; task_id: string; user_id: string; body: string; created_at: string; profiles: { display_name: string | null; email: string } };
type Attachment = { id: string; file_name: string; file_path: string; url?: string };

const priorityStyles: Record<Priority, string> = {
  low: "bg-sky-50 text-sky-700 ring-sky-100",
  medium: "bg-amber-50 text-amber-700 ring-amber-100",
  high: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function BoardView({ workspace, user }: { workspace: Workspace; user: { id: string; email: string } }) {
  const [supabase] = useState(() => createClient());
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ task: Task | null; columnId: string } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    const [columnResult, taskResult, memberResult, activityResult] = await Promise.all([
      supabase.from("board_columns").select("*").eq("workspace_id", workspace.id).order("position"),
      supabase.from("tasks").select("*").eq("workspace_id", workspace.id).order("position"),
      supabase.from("workspace_members").select("workspace_id, user_id, role, profiles(id, email, display_name, avatar_url)").eq("workspace_id", workspace.id),
      supabase.from("activity_logs").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(30),
    ]);
    const firstError = columnResult.error ?? taskResult.error ?? memberResult.error ?? activityResult.error;
    if (firstError) setError(firstError.message);
    else {
      setColumns((columnResult.data ?? []) as BoardColumn[]);
      setTasks((taskResult.data ?? []) as Task[]);
      setMembers((memberResult.data ?? []) as unknown as Member[]);
      setActivity((activityResult.data ?? []) as Activity[]);
    }
    setLoading(false);
  }, [supabase, workspace.id]);

  useEffect(() => {
    void loadBoard();
    const channel = supabase.channel(`board:${workspace.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_columns", filter: `workspace_id=eq.${workspace.id}` }, loadBoard)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspace.id}` }, loadBoard)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs", filter: `workspace_id=eq.${workspace.id}` }, loadBoard)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadBoard, supabase, workspace.id]);

  async function moveTask(taskId: string, columnId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.column_id === columnId) return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, column_id: columnId } : item));
    const { error } = await supabase.from("tasks").update({ column_id: columnId, position: tasks.filter((item) => item.column_id === columnId).length }).eq("id", taskId);
    if (error) { setError(error.message); void loadBoard(); }
  }

  async function addColumn() {
    const title = window.prompt("Column name");
    if (!title?.trim()) return;
    const { error } = await supabase.from("board_columns").insert({ workspace_id: workspace.id, title: title.trim(), position: columns.length });
    if (error) setError(error.message); else void loadBoard();
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setInviteStatus(null);
    const { error } = await supabase.rpc("invite_workspace_member", { target_workspace: workspace.id, member_email: inviteEmail });
    if (error) setInviteStatus(error.message);
    else { setInviteStatus("Member added to the workspace."); setInviteEmail(""); void loadBoard(); }
  }

  const memberById = useMemo(() => new Map(members.map((member) => [member.user_id, member.profiles])), [members]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f8f7] text-slate-900">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" aria-label="Back to workspaces" className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><ArrowLeft className="size-4" /></Link>
          <span className="hidden size-8 place-items-center rounded-lg bg-emerald-500 text-white sm:grid"><LayoutDashboard className="size-4" /></span>
          <ChevronRight className="hidden size-4 text-slate-300 sm:block" />
          <h1 className="truncate font-bold">{workspace.name}</h1>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" /> Live</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden -space-x-2 sm:flex">{members.slice(0,4).map((member) => <Avatar key={member.user_id} name={member.profiles?.display_name ?? member.profiles?.email ?? "?"} />)}</div>
          {workspace.owner_id === user.id && <button onClick={() => setInviteOpen((value) => !value)} className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold shadow-sm hover:border-emerald-200"><UserPlus className="size-4" /><span className="hidden sm:inline">Invite</span></button>}
          <button onClick={() => setShowActivity((value) => !value)} className={`grid size-9 place-items-center rounded-xl border shadow-sm ${showActivity ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}><ActivityIcon className="size-4" /></button>
        </div>
      </header>

      {inviteOpen && <form onSubmit={invite} className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 text-sm"><Users className="size-4 text-emerald-600" /><input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Teammate's registered email" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" /><button className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Add member</button>{inviteStatus && <span className={inviteStatus.startsWith('Member') ? 'text-emerald-600' : 'text-rose-600'}>{inviteStatus}</span>}</form>}
      {error && <div className="border-b border-rose-100 bg-rose-50 px-6 py-2 text-sm text-rose-700">{error}<button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button></div>}

      <div className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 overflow-x-auto p-4 lg:p-7">
          {loading ? <div className="grid min-w-[850px] grid-cols-3 gap-5">{[1,2,3].map((item) => <div key={item} className="h-[420px] animate-pulse rounded-2xl bg-slate-200/70" />)}</div> : (
            <div className="flex min-w-max items-start gap-5">
              {columns.map((column) => {
                const columnTasks = tasks.filter((task) => task.column_id === column.id);
                return (
                  <div key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void moveTask(event.dataTransfer.getData("taskId"), column.id)} className="w-[310px] rounded-2xl bg-slate-100/80 p-3">
                    <div className="mb-3 flex items-center justify-between px-1.5"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${column.title.toLowerCase().includes('done') ? 'bg-emerald-500' : column.title.toLowerCase().includes('progress') ? 'bg-amber-500' : 'bg-slate-400'}`} /><h2 className="text-sm font-bold">{column.title}</h2><span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-400">{columnTasks.length}</span></div></div>
                    <div className="min-h-20 space-y-3">
                      {columnTasks.map((task) => (
                        <article key={task.id} draggable onDragStart={(event) => { event.dataTransfer.setData("taskId", task.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setEditor({ task, columnId: column.id })} className="group cursor-grab rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md active:cursor-grabbing">
                          <div className="flex items-start justify-between gap-2"><span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider ring-1 ${priorityStyles[task.priority]}`}>{task.priority}</span><GripVertical className="size-4 text-slate-200 group-hover:text-slate-400" /></div>
                          <h3 className="mt-3 text-sm font-bold leading-5">{task.title}</h3>
                          {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{task.description}</p>}
                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-slate-400"><div className="flex items-center gap-3">{task.due_date && <span className="flex items-center gap-1 text-[10px]"><CalendarDays className="size-3" />{new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>}<MessageSquare className="size-3.5" /></div>{task.assignee_id ? <Avatar small name={memberById.get(task.assignee_id)?.display_name ?? memberById.get(task.assignee_id)?.email ?? "?"} /> : <CircleUserRound className="size-5" />}</div>
                        </article>
                      ))}
                    </div>
                    <button onClick={() => setEditor({ task: null, columnId: column.id })} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-white hover:text-emerald-600"><Plus className="size-4" /> Add task</button>
                  </div>
                );
              })}
              <button onClick={addColumn} className="flex w-[220px] items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-500 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"><Plus className="size-4" /> Add column</button>
            </div>
          )}
        </section>

        {showActivity && <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-5 lg:block"><div className="mb-6 flex items-center justify-between"><h2 className="font-bold">Recent activity</h2><button onClick={() => setShowActivity(false)}><X className="size-4 text-slate-400" /></button></div><div className="space-y-5">{activity.map((item) => { const actor = item.actor_id ? memberById.get(item.actor_id) : null; return <div key={item.id} className="flex gap-3"><Avatar small name={actor?.display_name ?? actor?.email ?? 'System'} /><div className="min-w-0"><p className="text-xs leading-5"><strong>{actor?.display_name ?? actor?.email?.split('@')[0] ?? 'Someone'}</strong> {item.action} {item.entity_type === 'task' && <span className="font-medium">“{item.metadata?.title}”</span>}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="size-3" />{timeAgo(item.created_at)}</p></div></div>; })}</div></aside>}
      </div>

      {editor && <TaskEditor workspaceId={workspace.id} userId={user.id} task={editor.task} columnId={editor.columnId} members={members} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void loadBoard(); }} />}
    </main>
  );
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const letters = name.split(/\s|@/).filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase();
  return <span title={name} className={`grid shrink-0 place-items-center rounded-full border-2 border-white bg-slate-900 font-bold text-white ${small ? 'size-6 text-[8px]' : 'size-8 text-[9px]'}`}>{letters || '?'}</span>;
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function TaskEditor({ workspaceId, userId, task, columnId, members, onClose, onSaved }: { workspaceId: string; userId: string; task: Task | null; columnId: string; members: Member[]; onClose: () => void; onSaved: () => void }) {
  const [supabase] = useState(() => createClient());
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [assignee, setAssignee] = useState(task?.assignee_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const loadDetails = useCallback(async () => {
    if (!task) return;
    const [commentResult, attachmentResult] = await Promise.all([
      supabase.from("comments").select("id, task_id, user_id, body, created_at, profiles(display_name, email)").eq("task_id", task.id).order("created_at"),
      supabase.from("attachments").select("id, file_name, file_path").eq("task_id", task.id).order("created_at"),
    ]);
    if (commentResult.data) setComments(commentResult.data as unknown as Comment[]);
    if (attachmentResult.data) {
      const signed = await Promise.all(attachmentResult.data.map(async (file) => {
        const { data } = await supabase.storage.from("task-attachments").createSignedUrl(file.file_path, 3600);
        return { ...file, url: data?.signedUrl } as Attachment;
      }));
      setAttachments(signed);
    }
  }, [supabase, task]);

  useEffect(() => {
    void loadDetails();
    if (!task) return;
    const channel = supabase.channel(`task:${task.id}`).on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `task_id=eq.${task.id}` }, loadDetails).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadDetails, supabase, task]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!title.trim()) return;
    setSaving(true); setError(null);
    const values = { title: title.trim(), description: description.trim(), priority, due_date: dueDate || null, assignee_id: assignee || null };
    const result = task
      ? await supabase.from("tasks").update(values).eq("id", task.id)
      : await supabase.from("tasks").insert({ ...values, workspace_id: workspaceId, column_id: columnId, created_by: userId, position: 999 });
    if (result.error) { setError(result.error.message); setSaving(false); } else onSaved();
  }

  async function removeTask() {
    if (!task || !window.confirm("Delete this task and its comments?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) setError(error.message); else onSaved();
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault(); if (!task || !comment.trim()) return;
    const { error } = await supabase.from("comments").insert({ task_id: task.id, user_id: userId, body: comment.trim() });
    if (error) setError(error.message); else { setComment(""); void loadDetails(); }
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !task) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${workspaceId}/${task.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("task-attachments").upload(path, file);
    if (upload.error) { setError(upload.error.message); return; }
    const { error } = await supabase.from("attachments").insert({ task_id: task.id, uploaded_by: userId, file_name: file.name, file_path: path });
    if (error) setError(error.message); else void loadDetails();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">{task ? 'Task details' : 'New task'}</p><h2 className="mt-1 font-bold">{task ? task.title : 'Add work to the board'}</h2></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl hover:bg-slate-100"><X className="size-4" /></button></div>
        <div className={`grid ${task ? 'lg:grid-cols-[1fr_280px]' : ''}`}>
          <form onSubmit={save} className="space-y-5 p-6">
            <label className="block"><span className="mb-2 block text-xs font-bold text-slate-500">Title</span><input autoFocus required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400" placeholder="What needs to be done?" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-slate-500">Description</span><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-emerald-400" placeholder="Add context, acceptance criteria, or links…" /></label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label><span className="mb-2 block text-xs font-bold text-slate-500">Priority</span><select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label><span className="mb-2 block text-xs font-bold text-slate-500">Due date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none" /></label>
              <label><span className="mb-2 block text-xs font-bold text-slate-500">Assignee</span><select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.profiles?.display_name ?? member.profiles?.email}</option>)}</select></label>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex items-center justify-between border-t border-slate-100 pt-5">{task ? <button type="button" onClick={removeTask} className="flex items-center gap-2 text-xs font-bold text-rose-600"><Trash2 className="size-4" />Delete</button> : <span />}<button disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"><Check className="size-4" />{saving ? 'Saving…' : 'Save task'}</button></div>
          </form>
          {task && <aside className="border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
            <div><div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Attachments</h3><label className="cursor-pointer rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Upload className="size-4" /><input type="file" className="hidden" onChange={uploadFile} /></label></div><div className="mt-3 space-y-2">{attachments.length === 0 ? <p className="text-xs text-slate-400">No files attached.</p> : attachments.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white p-2.5 text-xs font-medium shadow-sm hover:text-emerald-600"><Paperclip className="size-3.5 shrink-0" /><span className="truncate">{file.file_name}</span></a>)}</div></div>
            <div className="mt-7"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Discussion</h3><div className="mt-3 max-h-48 space-y-3 overflow-y-auto">{comments.length === 0 ? <p className="text-xs text-slate-400">Start the conversation.</p> : comments.map((item) => <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm"><p className="text-[10px] font-bold text-slate-500">{item.profiles?.display_name ?? item.profiles?.email?.split('@')[0]}</p><p className="mt-1 text-xs leading-5 text-slate-700">{item.body}</p></div>)}</div><form onSubmit={addComment} className="mt-3 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-400" /><button aria-label="Send comment" className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white"><Send className="size-3.5" /></button></form></div>
          </aside>}
        </div>
      </div>
    </div>
  );
}

