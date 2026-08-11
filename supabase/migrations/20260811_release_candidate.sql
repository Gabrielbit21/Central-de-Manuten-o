-- Central de Manutenção SE v1.2.0
-- Consolidação pós-homologação:
-- 1) mantém somente os triggers Web Push;
-- 2) corrige privilégios usados pelas Edge Functions;
-- 3) recupera notificações antigas presas em "sending";
-- 4) habilita criação de conta por e-mail verificado, sem aprovação manual.

-- ===== Push: elimina definitivamente o canal antigo =====
drop trigger if exists trg_maintenance_reports_whatsapp_events
on public.maintenance_reports;

-- Remove funções do canal antigo que não são mais utilizadas.
drop function if exists public.enqueue_report_whatsapp_events();
drop function if exists public.enqueue_whatsapp_notification(text, public.maintenance_reports, public.profiles, text);

drop trigger if exists trg_maintenance_reports_push_events
on public.maintenance_reports;

create trigger trg_maintenance_reports_push_events
after insert or update of status, revision, payload, rejection_reason
on public.maintenance_reports
for each row
execute function public.enqueue_report_push_events();

-- ===== Push: privilégios necessários ao backend =====
grant select, update on table public.push_subscriptions to service_role;
grant select, update on table public.notification_outbox to service_role;
grant select on table public.substations to service_role;
grant select on table public.profiles to service_role;

-- Mantém a leitura do histórico de notificações limitada ao próprio usuário.
alter table public.notification_outbox enable row level security;
grant select on table public.notification_outbox to authenticated;
drop policy if exists notification_outbox_select_own on public.notification_outbox;
create policy notification_outbox_select_own
on public.notification_outbox
for select
to authenticated
using ((select auth.uid()) = recipient_user_id);

-- Registros que ficaram presos durante os testes anteriores deixam de aparecer como "Enviando".
update public.notification_outbox
set status = 'failed',
    last_error = coalesce(last_error, 'Envio interrompido em versão anterior; pode ser reenviado pela administração.'),
    updated_at = now()
where status = 'sending'
  and updated_at < now() - interval '5 minutes';

-- ===== Cadastro por código de verificação =====
-- Segurança: o autoatendimento cria exclusivamente perfil de Equipe de Campo.
-- Perfis administrativos continuam sendo criados/promovidos por administradores.
create or replace function public.finalize_verified_self_signup()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  auth_email text;
  confirmed_at timestamptz;
  metadata jsonb;
  current_profile public.profiles;
  result public.profiles;
  contact_phone text;
  requested_name text;
begin
  if uid is null then
    raise exception 'Sessão de verificação não encontrada.';
  end if;

  select u.email, u.email_confirmed_at, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into auth_email, confirmed_at, metadata
    from auth.users u
   where u.id = uid;

  if auth_email is null then
    raise exception 'Usuário de autenticação não encontrado.';
  end if;

  if confirmed_at is null then
    raise exception 'Confirme o e-mail antes de concluir a conta.';
  end if;

  if lower(auth_email) !~ '^[^@]+@energisa\.com\.br$' then
    raise exception 'A criação de conta é restrita ao domínio @energisa.com.br.';
  end if;

  if coalesce(metadata ->> 'central_self_signup', 'false') <> 'true' then
    raise exception 'Este cadastro não foi iniciado pelo fluxo Criar conta.';
  end if;

  select * into current_profile
    from public.profiles
   where id = uid;

  if current_profile.id is null then
    raise exception 'Perfil do usuário ainda não foi criado. Recarregue e tente novamente.';
  end if;

  if current_profile.approval_status = 'rejected' then
    raise exception 'Este cadastro foi bloqueado pela administração.';
  end if;

  -- Não altera usuários que já tenham sido administrativamente promovidos/ativados.
  if current_profile.approval_status = 'approved' and current_profile.active = true then
    return current_profile;
  end if;

  contact_phone := public.normalize_whatsapp_e164(metadata ->> 'whatsapp_number');
  requested_name := nullif(btrim(metadata ->> 'display_name'), '');

  if contact_phone is null then
    raise exception 'Telefone/WhatsApp de contato inválido.';
  end if;

  update public.profiles
     set display_name = coalesce(requested_name, display_name, split_part(auth_email, '@', 1)),
         role = 'field',
         requested_role = 'field',
         active = true,
         approval_status = 'approved',
         approved_at = now(),
         approved_by = null,
         whatsapp_number = contact_phone,
         push_notifications_enabled = true,
         notify_report_received = true,
         notify_report_approved = true,
         notify_report_rejected = true
   where id = uid
   returning * into result;

  return result;
end;
$$;

revoke all on function public.finalize_verified_self_signup() from public, anon;
grant execute on function public.finalize_verified_self_signup() to authenticated;

-- O trigger da fila deve ser único.
drop trigger if exists whatsapp_notification_dispatch on public.notification_outbox;
drop trigger if exists push_notification_dispatch on public.notification_outbox;
create trigger push_notification_dispatch
after insert on public.notification_outbox
for each row
execute function public.dispatch_push_notification_webhook();
