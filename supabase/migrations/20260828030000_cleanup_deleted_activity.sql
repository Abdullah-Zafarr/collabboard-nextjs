-- Keep the activity feed aligned with the records that still exist.
create or replace function public.cleanup_deleted_entity_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.activity_logs
  where workspace_id = old.workspace_id
    and entity_type = tg_argv[0]
    and entity_id = old.id;

  return old;
end;
$$;

drop trigger if exists cleanup_deleted_task_activity on public.tasks;
create trigger cleanup_deleted_task_activity
after delete on public.tasks
for each row execute function public.cleanup_deleted_entity_activity('task');

drop trigger if exists cleanup_deleted_column_activity on public.board_columns;
create trigger cleanup_deleted_column_activity
after delete on public.board_columns
for each row execute function public.cleanup_deleted_entity_activity('column');
