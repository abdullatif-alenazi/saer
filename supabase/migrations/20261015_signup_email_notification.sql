-- Run once in Supabase Dashboard > SQL Editor after enabling pg_net.
-- Store the shared webhook secret in Supabase Vault with the name
-- `saer_signup_webhook_secret` before relying on signup notifications.

create or replace function public.notify_saer_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
   where name = 'saer_signup_webhook_secret'
   limit 1;

  if webhook_secret is null or length(webhook_secret) < 32 then
    raise warning 'Saer signup email notification is not configured: Vault secret is missing or too short';
    return new;
  end if;

  perform net.http_post(
    url := 'https://saer-dun.vercel.app/api/signup-notification',
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'auth',
      'table', 'users',
      'record', jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'created_at', new.created_at
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-saer-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke execute on function public.notify_saer_signup() from public, anon, authenticated;

drop trigger if exists saer_signup_email_notification on auth.users;
create trigger saer_signup_email_notification
  after insert on auth.users
  for each row execute function public.notify_saer_signup();
