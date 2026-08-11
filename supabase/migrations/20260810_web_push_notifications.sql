-- Central de Manutenção SE v1.1.0
-- Migração do canal WhatsApp para Web Push padrão + Central de Notificações.
-- Execute APÓS 20260810_whatsapp_notifications.sql caso a v1.0.0 já tenha sido aplicada.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists push_notifications_enabled boolean not null default true;

-- O telefone permanece como dado cadastral, mas deixa de ser requisito técnico para notificações.
alter table public.notification_outbox
  alter column recipient_phone drop not null,
  alter column provider set default 'web_push';

-- Eventos ainda não processados pelo canal antigo não devem ser enviados acidentalmente.
update public.notification_outbox
   set status = 'skipped',
       last_error = coalesce(last_error, 'Canal WhatsApp descontinuado na v1.1.0; notificação preservada apenas no histórico.'),
       updated_at = now()
 where provider = 'meta_whatsapp_cloud_api'
   and status in ('queued','sending','failed');

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id, active);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.touch_push_subscription_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_push_subscription_updated_at on public.push_subscriptions;
create trigger trg_push_subscription_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_push_subscription_updated_at();

create or replace function public.upsert_own_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if nullif(btrim(p_endpoint),'') is null or nullif(btrim(p_p256dh),'') is null or nullif(btrim(p_auth),'') is null then
    raise exception 'Assinatura de push incompleta.';
  end if;

  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, platform, active, last_seen_at, last_error)
  values (auth.uid(), btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), nullif(p_user_agent,''), nullif(p_platform,''), true, now(), null)
  on conflict (endpoint) do update
     set user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         platform = excluded.platform,
         active = true,
         last_seen_at = now(),
         last_error = null
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.upsert_own_push_subscription(text,text,text,text,text) from public;
grant execute on function public.upsert_own_push_subscription(text,text,text,text,text) to authenticated;

create or replace function public.deactivate_own_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  update public.push_subscriptions
     set active = false, last_seen_at = now()
   where user_id = auth.uid() and endpoint = p_endpoint;
end;
$$;
revoke all on function public.deactivate_own_push_subscription(text) from public;
grant execute on function public.deactivate_own_push_subscription(text) to authenticated;

-- Preferências do próprio perfil. Mantém o telefone como contato e usa push_notifications_enabled para o novo canal.
create or replace function public.update_own_push_notification_preferences(
  p_whatsapp_number text,
  p_push_notifications_enabled boolean,
  p_notify_new_reports boolean,
  p_notify_report_received boolean,
  p_notify_report_approved boolean,
  p_notify_report_rejected boolean,
  p_notify_report_corrected boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  update public.profiles
     set whatsapp_number = case when nullif(btrim(coalesce(p_whatsapp_number,'')),'') is null then whatsapp_number else public.normalize_whatsapp_e164(p_whatsapp_number) end,
         push_notifications_enabled = coalesce(p_push_notifications_enabled, true),
         notify_new_reports = coalesce(p_notify_new_reports, true),
         notify_report_received = coalesce(p_notify_report_received, true),
         notify_report_approved = coalesce(p_notify_report_approved, true),
         notify_report_rejected = coalesce(p_notify_report_rejected, true),
         notify_report_corrected = coalesce(p_notify_report_corrected, true)
   where id = auth.uid()
   returning * into result;
  if result.id is null then raise exception 'Perfil não encontrado.'; end if;
  return result;
end;
$$;
revoke all on function public.update_own_push_notification_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.update_own_push_notification_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- A fila também funciona como Central de Notificações do usuário.
grant select on public.notification_outbox to authenticated;
drop policy if exists notification_outbox_select_own on public.notification_outbox;
create policy notification_outbox_select_own
on public.notification_outbox
for select
to authenticated
using (recipient_user_id = auth.uid());

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  update public.notification_outbox
     set read_at = coalesce(read_at, now()),
         status = case when status in ('sent','delivered') then 'read' else status end,
         updated_at = now()
   where id = p_id and recipient_user_id = auth.uid();
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  update public.notification_outbox
     set read_at = coalesce(read_at, now()),
         status = case when status in ('sent','delivered') then 'read' else status end,
         updated_at = now()
   where recipient_user_id = auth.uid() and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Novo enfileiramento independente de telefone.
create or replace function public.enqueue_push_notification(
  p_event_type text,
  p_report public.maintenance_reports,
  p_recipient public.profiles,
  p_event_suffix text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author_name text;
  asset_label text;
  event_key_value text;
  rejection_reason text;
begin
  if not coalesce(p_recipient.push_notifications_enabled,true) then return; end if;
  select display_name into author_name from public.profiles where id = p_report.author_id;
  asset_label := public.notification_asset_label(coalesce(p_report.payload,'{}'::jsonb));
  rejection_reason := coalesce(p_report.rejection_reason, p_report.payload ->> 'rejection_reason', 'Consulte o motivo na Central de Manutenção.');
  event_key_value := concat_ws(':', p_report.id::text, p_event_type, coalesce(p_report.revision,1)::text, p_recipient.id::text, p_event_suffix, 'push');

  insert into public.notification_outbox(event_key,event_type,report_id,report_revision,recipient_user_id,recipient_phone,payload,provider,status)
  values (
    event_key_value,
    p_event_type,
    p_report.id,
    coalesce(p_report.revision,1),
    p_recipient.id,
    p_recipient.whatsapp_number,
    jsonb_build_object(
      'report_number', p_report.report_number,
      'author_name', coalesce(author_name,'Equipe de Campo'),
      'substation_id', p_report.substation_id,
      'asset_label', asset_label,
      'created_at', p_report.created_at,
      'status', p_report.status,
      'revision', coalesce(p_report.revision,1),
      'rejection_reason', rejection_reason
    ),
    'web_push',
    'queued'
  ) on conflict (event_key) do nothing;
end;
$$;
revoke all on function public.enqueue_push_notification(text,public.maintenance_reports,public.profiles,text) from public, anon, authenticated;
grant execute on function public.enqueue_push_notification(text,public.maintenance_reports,public.profiles,text) to service_role;

create or replace function public.enqueue_report_push_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient public.profiles;
begin
  if tg_op = 'INSERT' then
    for recipient in
      select * from public.profiles
      where role = 'admin'
        and active = true
        and coalesce(approval_status,'approved') = 'approved'
        and push_notifications_enabled = true
        and notify_new_reports = true
    loop
      perform public.enqueue_push_notification('new_report_admin', new, recipient, 'insert');
    end loop;

    select * into recipient from public.profiles where id = new.author_id;
    if recipient.id is not null and recipient.active = true and coalesce(recipient.approval_status,'approved')='approved' and recipient.push_notifications_enabled and recipient.notify_report_received then
      perform public.enqueue_push_notification('report_received_field', new, recipient, 'insert');
    end if;
    return new;
  end if;

  if coalesce(new.revision,1) > coalesce(old.revision,1) or (new.status = 'corrigido' and old.status is distinct from new.status) then
    for recipient in
      select * from public.profiles
      where role = 'admin'
        and active = true
        and coalesce(approval_status,'approved') = 'approved'
        and push_notifications_enabled = true
        and notify_report_corrected = true
    loop
      perform public.enqueue_push_notification('report_corrected_admin', new, recipient, 'revision');
    end loop;
  end if;

  if old.status is distinct from new.status and new.status in ('aprovado','reprovado') then
    select * into recipient from public.profiles where id = new.author_id;
    if recipient.id is not null and recipient.active = true and coalesce(recipient.approval_status,'approved')='approved' and recipient.push_notifications_enabled then
      if new.status = 'aprovado' and recipient.notify_report_approved then
        perform public.enqueue_push_notification('report_approved_field', new, recipient, 'approved');
      elsif new.status = 'reprovado' and recipient.notify_report_rejected then
        perform public.enqueue_push_notification('report_rejected_field', new, recipient, 'rejected');
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_report_push_events() from public, anon, authenticated;

-- Desativa o trigger do canal antigo e instala o novo.
drop trigger if exists trg_maintenance_reports_whatsapp_events on public.maintenance_reports;
drop trigger if exists trg_maintenance_reports_push_events on public.maintenance_reports;
create trigger trg_maintenance_reports_push_events
after insert or update of status, revision, payload, rejection_reason on public.maintenance_reports
for each row execute function public.enqueue_report_push_events();
