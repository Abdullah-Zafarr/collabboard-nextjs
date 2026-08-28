-- CollabBoard: authenticated, realtime workspaces with RLS-protected content.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'member');
create type public.task_priority as enum ('low', 'medium', 'high');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 50),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  column_id uuid not null references public.board_columns(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  priority public.task_priority not null default 'medium',
  due_date date,
  position integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tasks_workspace_column_idx on public.tasks(workspace_id, column_id, position);
create index comments_task_idx on public.comments(task_id, created_at);
create index activity_workspace_idx on public.activity_logs(workspace_id, created_at desc);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id = target_workspace and owner_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill users that existed before this migration.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create or replace function public.create_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(workspace_name)) not between 1 and 80 then raise exception 'Workspace name is invalid'; end if;

  insert into public.workspaces (name, owner_id)
  values (trim(workspace_name), auth.uid()) returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');
  insert into public.board_columns (workspace_id, title, position) values
    (new_workspace_id, 'To do', 0),
    (new_workspace_id, 'In progress', 1),
    (new_workspace_id, 'Done', 2);
  insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (new_workspace_id, auth.uid(), 'created', 'workspace', new_workspace_id, jsonb_build_object('name', trim(workspace_name)));
  return new_workspace_id;
end;
$$;

create or replace function public.invite_workspace_member(target_workspace uuid, member_email text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_user uuid;
begin
  if not public.is_workspace_owner(target_workspace) then raise exception 'Only the owner can invite members'; end if;
  select id into target_user from public.profiles where lower(email) = lower(trim(member_email));
  if target_user is null then raise exception 'No registered user has that email'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace, target_user, 'member') on conflict do nothing;
  insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_workspace, auth.uid(), 'invited', 'member', target_user, jsonb_build_object('email', lower(trim(member_email))));
end;
$$;

create or replace function public.touch_task_and_log()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.workspace_id, auth.uid(), 'created', 'task', new.id, jsonb_build_object('title', new.title));
  elsif new.column_id is distinct from old.column_id then
    new.updated_at = now();
    insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.workspace_id, auth.uid(), 'moved', 'task', new.id, jsonb_build_object('title', new.title));
  else
    new.updated_at = now();
    insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.workspace_id, auth.uid(), 'updated', 'task', new.id, jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

create trigger task_activity before insert or update on public.tasks
for each row execute procedure public.touch_task_and_log();

create or replace function public.log_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, metadata)
  select workspace_id, auth.uid(), 'commented', 'task', id, jsonb_build_object('title', title)
  from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger comment_activity after insert on public.comments
for each row execute procedure public.log_comment();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles visible to self and collaborators" on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.workspace_members mine
  join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
  where mine.user_id = auth.uid() and theirs.user_id = profiles.id
));
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members view workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "owners update workspaces" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete workspaces" on public.workspaces for delete to authenticated using (owner_id = auth.uid());

create policy "members view membership" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners add members" on public.workspace_members for insert to authenticated with check (public.is_workspace_owner(workspace_id));
create policy "owners remove members" on public.workspace_members for delete to authenticated using (public.is_workspace_owner(workspace_id) and user_id <> auth.uid());

create policy "members view columns" on public.board_columns for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members add columns" on public.board_columns for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "members edit columns" on public.board_columns for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members delete columns" on public.board_columns for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy "members view tasks" on public.tasks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members add tasks" on public.tasks for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members edit tasks" on public.tasks for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members delete tasks" on public.tasks for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy "members view comments" on public.comments for select to authenticated using (
  exists (select 1 from public.tasks where tasks.id = comments.task_id and public.is_workspace_member(tasks.workspace_id))
);
create policy "members add comments" on public.comments for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.tasks where tasks.id = comments.task_id and public.is_workspace_member(tasks.workspace_id))
);
create policy "authors delete comments" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "members view attachments" on public.attachments for select to authenticated using (
  exists (select 1 from public.tasks where tasks.id = attachments.task_id and public.is_workspace_member(tasks.workspace_id))
);
create policy "members add attachments" on public.attachments for insert to authenticated with check (
  uploaded_by = auth.uid() and exists (select 1 from public.tasks where tasks.id = attachments.task_id and public.is_workspace_member(tasks.workspace_id))
);
create policy "uploaders delete attachments" on public.attachments for delete to authenticated using (uploaded_by = auth.uid());

create policy "members view activity" on public.activity_logs for select to authenticated using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 10485760)
on conflict (id) do nothing;

create or replace function public.can_access_workspace_file(object_name text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
begin
  return public.is_workspace_member(split_part(object_name, '/', 1)::uuid);
exception when others then return false;
end;
$$;

create policy "members read task files" on storage.objects for select to authenticated
using (bucket_id = 'task-attachments' and public.can_access_workspace_file(name));
create policy "members upload task files" on storage.objects for insert to authenticated
with check (bucket_id = 'task-attachments' and public.can_access_workspace_file(name));
create policy "members delete own task files" on storage.objects for delete to authenticated
using (bucket_id = 'task-attachments' and owner_id = auth.uid()::text and public.can_access_workspace_file(name));

do $$
begin
  alter publication supabase_realtime add table public.board_columns;
  alter publication supabase_realtime add table public.tasks;
  alter publication supabase_realtime add table public.comments;
  alter publication supabase_realtime add table public.activity_logs;
exception when duplicate_object then null;
end $$;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.invite_workspace_member(uuid, text) to authenticated;

