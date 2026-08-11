-- Central de Manutenção SE v1.1.1
-- Dispara a Edge Function push-dispatch após INSERT em notification_outbox.
-- Pré-requisito: secret `central_webhook_secret` criado no Supabase Vault
-- com o MESMO valor de CENTRAL_WEBHOOK_SECRET das Edge Functions.

create extension if not exists pg_net;

create or replace function public.dispatch_push_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
   where name = 'central_webhook_secret'
   order by created_at desc
   limit 1;

  if webhook_secret is null then
    raise exception 'Secret central_webhook_secret não encontrado no Vault.';
  end if;

  perform net.http_post(
    url := 'https://szshskfyocsumvmqwuem.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-central-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.dispatch_push_notification_webhook()
from public, anon, authenticated;

drop trigger if exists whatsapp_notification_dispatch
on public.notification_outbox;

drop trigger if exists push_notification_dispatch
on public.notification_outbox;

create trigger push_notification_dispatch
after insert on public.notification_outbox
for each row
execute function public.dispatch_push_notification_webhook();
