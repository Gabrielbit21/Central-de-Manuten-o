-- Central de Manutenção SE v1.0.0
-- Cadastro de WhatsApp + preferências + fila transacional de notificações.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_notifications_enabled boolean not null default true,
  add column if not exists notify_new_reports boolean not null default true,
  add column if not exists notify_report_received boolean not null default true,
  add column if not exists notify_report_approved boolean not null default true,
  add column if not exists notify_report_rejected boolean not null default true,
  add column if not exists notify_report_corrected boolean not null default true,
  add column if not exists whatsapp_verified_at timestamptz;

create or replace function public.normalize_whatsapp_e164(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  raw text := coalesce(trim(p_value), '');
  digits text;
begin
  if raw = '' then return null; end if;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if raw like '+%' then
    if length(digits) between 8 and 15 then return '+' || digits; end if;
    raise exception 'Número de WhatsApp inválido. Use o padrão internacional, por exemplo +55 32 99999-9999.';
  end if;
  if digits like '55%' and length(digits) between 12 and 13 then
    return '+' || digits;
  end if;
  if length(digits) between 10 and 11 then
    return '+55' || digits;
  end if;
  if length(digits) between 8 and 15 then
    return '+' || digits;
  end if;
  raise exception 'Número de WhatsApp inválido. Use o padrão internacional, por exemplo +55 32 99999-9999.';
end;
$$;

create or replace function public.normalize_profile_whatsapp()
returns trigger
language plpgsql
as $$
begin
  if new.whatsapp_number is not null then
    new.whatsapp_number := public.normalize_whatsapp_e164(new.whatsapp_number);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_whatsapp on public.profiles;
create trigger trg_profiles_normalize_whatsapp
before insert or update of whatsapp_number on public.profiles
for each row execute function public.normalize_profile_whatsapp();

do $$ begin
  alter table public.profiles
    add constraint profiles_whatsapp_e164_check
    check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');
exception when duplicate_object then null;
end $$;

-- Sincroniza o WhatsApp informado no autocadastro para o perfil criado pelo fluxo já existente.
create or replace function public.zz_sync_profile_whatsapp_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  phone text;
begin
  phone := new.raw_user_meta_data ->> 'whatsapp_number';
  if phone is not null and btrim(phone) <> '' then
    update public.profiles
       set whatsapp_number = public.normalize_whatsapp_e164(phone),
           whatsapp_notifications_enabled = coalesce((new.raw_user_meta_data ->> 'whatsapp_notifications_enabled')::boolean, true)
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.zz_sync_profile_whatsapp_from_auth_metadata() from public, anon, authenticated;

drop trigger if exists zz_sync_profile_whatsapp_from_auth_metadata on auth.users;
create trigger zz_sync_profile_whatsapp_from_auth_metadata
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.zz_sync_profile_whatsapp_from_auth_metadata();

-- Edição do próprio telefone/preferências sem expor permissão de escrita ampla na tabela profiles.
create or replace function public.update_own_notification_preferences(
  p_whatsapp_number text,
  p_whatsapp_notifications_enabled boolean,
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
  if public.normalize_whatsapp_e164(p_whatsapp_number) is null then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  update public.profiles
     set whatsapp_number = public.normalize_whatsapp_e164(p_whatsapp_number),
         whatsapp_notifications_enabled = coalesce(p_whatsapp_notifications_enabled, true),
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
revoke all on function public.update_own_notification_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.update_own_notification_preferences(text,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in (
    'new_report_admin',
    'report_received_field',
    'report_approved_field',
    'report_rejected_field',
    'report_corrected_admin'
  )),
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  report_revision integer not null default 1,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_phone text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','read','failed','skipped')),
  provider text not null default 'meta_whatsapp_cloud_api',
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);

-- Claim atômico: impede duas execuções concorrentes de enviarem a mesma mensagem.
create or replace function public.claim_notification_outbox(p_id uuid)
returns setof public.notification_outbox
language sql
security definer
set search_path = public
as $$
  update public.notification_outbox
     set status = 'sending',
         attempts = attempts + 1,
         last_error = null,
         updated_at = now()
   where id = p_id
     and status in ('queued','failed')
     and attempts < 5
  returning *;
$$;
revoke all on function public.claim_notification_outbox(uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(uuid) to service_role;

create index if not exists notification_outbox_status_idx on public.notification_outbox(status, created_at);
create index if not exists notification_outbox_report_idx on public.notification_outbox(report_id, created_at desc);
create index if not exists notification_outbox_recipient_idx on public.notification_outbox(recipient_user_id, created_at desc);
create unique index if not exists notification_outbox_provider_message_idx on public.notification_outbox(provider_message_id) where provider_message_id is not null;

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

create or replace function public.touch_notification_outbox_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_notification_outbox_updated_at on public.notification_outbox;
create trigger trg_notification_outbox_updated_at
before update on public.notification_outbox
for each row execute function public.touch_notification_outbox_updated_at();

create table if not exists public.user_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  target_id uuid,
  target_name text,
  target_email text,
  action text not null,
  action_label text,
  details text,
  created_at timestamptz not null default now()
);
alter table public.user_admin_audit enable row level security;
revoke all on public.user_admin_audit from anon, authenticated;

create or replace function public.notification_asset_label(p_payload jsonb)
returns text
language plpgsql
immutable
as $$
declare
  asset jsonb;
  label text;
  count_assets integer;
begin
  asset := coalesce(p_payload -> 'equipamentosSnapshot' -> 0, '{}'::jsonb);
  label := coalesce(
    nullif(asset ->> 'nome',''),
    nullif(asset ->> 'name',''),
    nullif(asset ->> 'identificacao',''),
    nullif(asset ->> 'sgd',''),
    nullif(asset ->> 'id',''),
    'Ativo não informado'
  );
  count_assets := jsonb_array_length(coalesce(p_payload -> 'equipamentosSnapshot','[]'::jsonb));
  if count_assets > 1 then label := label || format(' (+%s)', count_assets - 1); end if;
  return label;
exception when others then
  return 'Ativo não informado';
end;
$$;

create or replace function public.enqueue_whatsapp_notification(
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
  if p_recipient.whatsapp_number is null or not coalesce(p_recipient.whatsapp_notifications_enabled,true) then return; end if;
  select display_name into author_name from public.profiles where id = p_report.author_id;
  asset_label := public.notification_asset_label(coalesce(p_report.payload,'{}'::jsonb));
  rejection_reason := coalesce(p_report.rejection_reason, p_report.payload ->> 'rejection_reason', 'Consulte o motivo na Central de Manutenção.');
  event_key_value := concat_ws(':', p_report.id::text, p_event_type, coalesce(p_report.revision,1)::text, p_recipient.id::text, p_event_suffix);
  insert into public.notification_outbox(event_key,event_type,report_id,report_revision,recipient_user_id,recipient_phone,payload)
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
    )
  ) on conflict (event_key) do nothing;
end;
$$;

revoke all on function public.enqueue_whatsapp_notification(text,public.maintenance_reports,public.profiles,text) from public, anon, authenticated;
grant execute on function public.enqueue_whatsapp_notification(text,public.maintenance_reports,public.profiles,text) to service_role;

create or replace function public.enqueue_report_whatsapp_events()
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
        and whatsapp_number is not null
        and whatsapp_notifications_enabled = true
        and notify_new_reports = true
    loop
      perform public.enqueue_whatsapp_notification('new_report_admin', new, recipient, 'insert');
    end loop;

    select * into recipient from public.profiles where id = new.author_id;
    if recipient.id is not null and recipient.active = true and coalesce(recipient.approval_status,'approved')='approved' and recipient.notify_report_received then
      perform public.enqueue_whatsapp_notification('report_received_field', new, recipient, 'insert');
    end if;
    return new;
  end if;

  if coalesce(new.revision,1) > coalesce(old.revision,1) or (new.status = 'corrigido' and old.status is distinct from new.status) then
    for recipient in
      select * from public.profiles
      where role = 'admin'
        and active = true
        and coalesce(approval_status,'approved') = 'approved'
        and whatsapp_number is not null
        and whatsapp_notifications_enabled = true
        and notify_report_corrected = true
    loop
      perform public.enqueue_whatsapp_notification('report_corrected_admin', new, recipient, 'revision');
    end loop;
  end if;

  if old.status is distinct from new.status and new.status in ('aprovado','reprovado') then
    select * into recipient from public.profiles where id = new.author_id;
    if recipient.id is not null and recipient.active = true and coalesce(recipient.approval_status,'approved')='approved' then
      if new.status = 'aprovado' and recipient.notify_report_approved then
        perform public.enqueue_whatsapp_notification('report_approved_field', new, recipient, 'approved');
      elsif new.status = 'reprovado' and recipient.notify_report_rejected then
        perform public.enqueue_whatsapp_notification('report_rejected_field', new, recipient, 'rejected');
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_report_whatsapp_events() from public, anon, authenticated;

drop trigger if exists trg_maintenance_reports_whatsapp_events on public.maintenance_reports;
create trigger trg_maintenance_reports_whatsapp_events
after insert or update of status, revision, payload, rejection_reason on public.maintenance_reports
for each row execute function public.enqueue_report_whatsapp_events();

-- Faz backfill apenas do formato dos números já existentes; não cria notificações retroativas.
update public.profiles
set whatsapp_number = public.normalize_whatsapp_e164(whatsapp_number)
where whatsapp_number is not null and whatsapp_number !~ '^\+[1-9][0-9]{7,14}$';
