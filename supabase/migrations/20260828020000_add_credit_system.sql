-- Persistent credits and atomic charges for workspace/column creation.
create table if not exists public.credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits_count integer not null default 50 check (credits_count >= 0),
  user_email text not null,
  updated_at timestamptz not null default now()
);

insert into public.credits (user_id, credits_count, user_email)
select id, 50, email
from auth.users
on conflict (user_id) do nothing;

alter table public.credits enable row level security;

drop policy if exists "users view own credits" on public.credits;
create policy "users view own credits"
on public.credits for select to authenticated
using (user_id = auth.uid());

-- Keep credit balances server-controlled. There is intentionally no client
-- insert/update/delete policy for this table.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.credits (user_id, credits_count, user_email)
  values (new.id, 50, new.email)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.create_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_workspace_id uuid;
  remaining_credits integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(workspace_name)) not between 1 and 80 then
    raise exception 'Workspace name is invalid';
  end if;

  update public.credits
  set credits_count = credits_count - 25, updated_at = now()
  where user_id = auth.uid() and credits_count >= 25
  returning credits_count into remaining_credits;

  if remaining_credits is null then
    raise exception 'You need 25 credits to create a workspace';
  end if;

  insert into public.workspaces (name, owner_id)
  values (trim(workspace_name), auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into public.board_columns (workspace_id, title, position) values
    (new_workspace_id, 'To do', 0),
    (new_workspace_id, 'In progress', 1),
    (new_workspace_id, 'Done', 2);

  insert into public.activity_logs (
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    new_workspace_id,
    auth.uid(),
    'created',
    'workspace',
    new_workspace_id,
    jsonb_build_object('name', trim(workspace_name), 'credits_spent', 25)
  );

  return new_workspace_id;
end;
$$;

create or replace function public.create_board_column(
  target_workspace uuid,
  column_title text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_column_id uuid;
  next_position integer;
  remaining_credits integer;
begin
  if auth.uid() is null or not public.is_workspace_member(target_workspace) then
    raise exception 'Workspace access required';
  end if;
  if char_length(trim(column_title)) not between 1 and 50 then
    raise exception 'Column name is invalid';
  end if;

  update public.credits
  set credits_count = credits_count - 10, updated_at = now()
  where user_id = auth.uid() and credits_count >= 10
  returning credits_count into remaining_credits;

  if remaining_credits is null then
    raise exception 'You need 10 credits to add a column';
  end if;

  select coalesce(max(position), -1) + 1
  into next_position
  from public.board_columns
  where workspace_id = target_workspace;

  insert into public.board_columns (workspace_id, title, position)
  values (target_workspace, trim(column_title), next_position)
  returning id into new_column_id;

  insert into public.activity_logs (
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target_workspace,
    auth.uid(),
    'created',
    'column',
    new_column_id,
    jsonb_build_object('title', trim(column_title), 'credits_spent', 10)
  );

  return new_column_id;
end;
$$;

-- Columns must be created through the charged RPC, not inserted freely.
drop policy if exists "members add columns" on public.board_columns;

grant select on public.credits to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.create_board_column(uuid, text) to authenticated;
