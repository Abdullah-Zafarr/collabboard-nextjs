import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, LayoutDashboard, MessageSquareText, Radio, ShieldCheck, Users } from "lucide-react";

const cards = [
  { title: "Plan onboarding flow", label: "Design", labelClass: "bg-violet-50 text-violet-700" },
  { title: "Build project analytics", label: "Product", labelClass: "bg-amber-50 text-amber-700" },
  { title: "Review invitation flow", label: "QA", labelClass: "bg-emerald-50 text-emerald-700" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8faf9] text-slate-950">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-200"><LayoutDashboard className="size-5" /></span>CollabBoard</Link>
        <div className="flex items-center gap-2"><Link href="/auth/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Log in</Link><Link href="/auth/sign-up" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-200">Start planning</Link></div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pt-24">
        <div className="relative z-10 flex flex-col justify-center">
          <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Move work forward, <span className="text-emerald-500">together.</span></h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-slate-600">One calm, collaborative space for your team to plan projects, share context, and turn ideas into finished work.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/auth/sign-up" className="group flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-600">Create your workspace <ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link><span className="flex items-center gap-2 text-sm font-medium text-slate-500"><CheckCircle2 className="size-4 text-emerald-500" /> Free to get started</span></div>
        </div>

        <div className="relative min-h-[500px]">
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-emerald-200/50 blur-3xl" /><div className="absolute -bottom-20 left-10 size-72 rounded-full bg-violet-200/40 blur-3xl" />
          <div className="relative h-full rounded-[2rem] border border-white bg-white/85 p-5 shadow-[0_35px_80px_-30px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p><h2 className="mt-1 text-xl font-bold">Website launch</h2></div><div className="flex -space-x-2">{['AM','JK','SY'].map((item, index) => <span key={item} className={`grid size-9 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white ${['bg-violet-500','bg-amber-500','bg-sky-500'][index]}`}>{item}</span>)}</div></div>
            <div className="grid gap-3 sm:grid-cols-3">{['To do','In progress','Done'].map((column, index) => <div key={column} className="rounded-2xl bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-600">{column}</span><span className="text-[10px] text-slate-400">{index + 1}</span></div>{cards.slice(index, index + (index === 0 ? 2 : 1)).map((card) => <div key={card.title} className="mb-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${card.labelClass}`}>{card.label}</span><p className="mt-3 text-xs font-bold leading-5">{card.title}</p><div className="mt-4 flex items-center justify-between text-slate-400"><CalendarDays className="size-3" /><span className="size-5 rounded-full bg-slate-200 ring-2 ring-white" /></div></div>)}</div>)}</div>
            <div className="absolute -bottom-6 -left-5 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-xl"><span className="relative grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Radio className="size-4" /><span className="absolute right-0 top-0 size-2 rounded-full bg-emerald-500 ring-2 ring-white" /></span><div><p className="text-xs font-bold">Synced in real time</p><p className="text-[10px] text-slate-400">Everyone sees the latest work</p></div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-3 lg:px-8">{[
        { icon: Users, title: 'Built for teams', body: 'Invite collaborators and stay aligned in one shared workspace.' },
        { icon: MessageSquareText, title: 'Context stays close', body: 'Discuss the work directly on every task.' },
        { icon: ShieldCheck, title: 'Private by design', body: 'Supabase RLS keeps each workspace safely separated.' },
      ].map(({icon: Icon, title, body}) => <div key={title} className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon className="size-5" /></span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{body}</p></div></div>)}</div></section>
    </main>
  );
}

