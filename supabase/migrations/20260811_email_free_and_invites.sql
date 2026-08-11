-- Central de Manutenção SE v1.3.0
-- E-mail livre + código de convite administrativo como contingência.

create table if not exists public.signup_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_email text,
  used_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint signup_invites_expiry_check check (expires_at > created_at)
);

create index if not exists signup_invites_active_idx on public.signup_invites (expires_at desc) where used_at is null and revoked_at is null;
alter table public.signup_invites enable row level security;
revoke all on table public.signup_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_invites to service_role;

-- Autoatendimento: qualquer endereço de e-mail válido pode ser confirmado por OTP.
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
  if uid is null then raise exception 'Sessão de verificação não encontrada.'; end if;
  select u.email, u.email_confirmed_at, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into auth_email, confirmed_at, metadata from auth.users u where u.id = uid;
  if auth_email is null then raise exception 'Usuário de autenticação não encontrado.'; end if;
  if confirmed_at is null then raise exception 'Confirme o e-mail antes de concluir a conta.'; end if;
  if lower(auth_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Endereço de e-mail inválido.'; end if;
  if coalesce(metadata ->> 'central_self_signup', 'false') <> 'true' then raise exception 'Este cadastro não foi iniciado pelo fluxo Criar conta.'; end if;
  select * into current_profile from public.profiles where id = uid;
  if current_profile.id is null then raise exception 'Perfil do usuário ainda não foi criado. Recarregue e tente novamente.'; end if;
  if current_profile.approval_status = 'rejected' then raise exception 'Este cadastro foi bloqueado pela administração.'; end if;
  if current_profile.approval_status = 'approved' and current_profile.active = true then return current_profile; end if;
  contact_phone := public.normalize_whatsapp_e164(metadata ->> 'whatsapp_number');
  requested_name := nullif(btrim(metadata ->> 'display_name'), '');
  if contact_phone is null then raise exception 'Telefone/WhatsApp de contato inválido.'; end if;
  update public.profiles
     set display_name = coalesce(requested_name, display_name, split_part(auth_email, '@', 1)),
         role = 'field', requested_role = 'field', active = true, approval_status = 'approved',
         approved_at = now(), approved_by = null, whatsapp_number = contact_phone,
         push_notifications_enabled = true, notify_report_received = true,
         notify_report_approved = true, notify_report_rejected = true
   where id = uid returning * into result;
  return result;
end;
$$;
revoke all on function public.finalize_verified_self_signup() from public, anon;
grant execute on function public.finalize_verified_self_signup() to authenticated;
