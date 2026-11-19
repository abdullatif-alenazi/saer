-- Atomic compare-and-swap for Saer snapshots. Apply only to a test project first.
-- Existing clients are covered by the trigger, which increments revision on every UPDATE.
alter table public.saer_state
  add column if not exists revision bigint not null default 1;

create or replace function public.bump_saer_state_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.revision := old.revision + 1;
  if new.updated_at <= old.updated_at then
    new.updated_at := old.updated_at + interval '1 microsecond';
  end if;
  return new;
end;
$$;

drop trigger if exists saer_state_revision_before_update on public.saer_state;
create trigger saer_state_revision_before_update
before update on public.saer_state
for each row execute function public.bump_saer_state_revision();

create or replace function public.sync_saer_state(
  p_expected_revision bigint,
  p_payload jsonb
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid;
  saved_revision bigint;
  saved_at timestamptz;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload must be a JSON object' using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.saer_state(user_id, payload, updated_at)
    values (caller_id, p_payload, clock_timestamp())
    on conflict (user_id) do nothing
    returning saer_state.revision, saer_state.updated_at into saved_revision, saved_at;
  else
    update public.saer_state as state
       set payload = p_payload,
           updated_at = greatest(clock_timestamp(), state.updated_at + interval '1 microsecond')
     where state.user_id = caller_id
       and state.revision = p_expected_revision
    returning state.revision, state.updated_at into saved_revision, saved_at;
  end if;

  if saved_revision is not null then
    return query select saved_revision, saved_at;
  end if;
  -- No returned row means the expected revision was stale; caller must fetch and merge.
end;
$$;

revoke all on function public.bump_saer_state_revision() from public, anon, authenticated;
revoke all on function public.sync_saer_state(bigint, jsonb) from public, anon;
grant execute on function public.sync_saer_state(bigint, jsonb) to authenticated;
