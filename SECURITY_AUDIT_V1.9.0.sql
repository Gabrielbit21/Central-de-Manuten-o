-- Central de Manutenção SE v1.9.0 — auditoria pós-hardening (somente leitura)

-- 1) RLS nas tabelas operacionais
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs',
    'notification_outbox','push_subscriptions','signup_invites','user_admin_audit'
  )
order by c.relname;

-- 2) Políticas das tabelas públicas
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs',
    'notification_outbox','push_subscriptions','signup_invites','user_admin_audit'
  )
order by tablename, policyname;

-- 3) Buckets sensíveis devem ser privados
select id, name, public
from storage.buckets
where id in ('user-profile-photos','asset-profile-photos','maintenance-photos')
order by id;

-- 4) Políticas de Storage relacionadas à Central
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual,'') ilike '%user-profile-photos%'
    or coalesce(qual,'') ilike '%asset-profile-photos%'
    or coalesce(qual,'') ilike '%maintenance-photos%'
    or coalesce(with_check,'') ilike '%user-profile-photos%'
    or coalesce(with_check,'') ilike '%asset-profile-photos%'
    or coalesce(with_check,'') ilike '%maintenance-photos%'
  )
order by policyname;

-- 5) PAM deve estar na nuvem antes da publicação do frontend sem seed estático
select count(*) as pam_rows from public.maintenance_plan_items;

-- 6) View de diretório seguro deve existir
select table_schema, table_name
from information_schema.views
where table_schema='public' and table_name='profile_directory';

-- 7) Verifica privilégios concedidos a anon/authenticated nas tabelas operacionais
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated')
  and table_name in (
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
  )
order by table_name, grantee, privilege_type;

-- 8) RPCs usados pelo frontend: anon não deve executar; authenticated deve executar
select
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = any(array[
    'apply_asset_bulk_update','approve_maintenance_report','clear_own_password_change_requirement',
    'complete_pam_from_approved_report','correct_maintenance_report','deactivate_own_push_subscription',
    'finalize_verified_self_signup','mark_all_notifications_read','mark_notification_read',
    'purge_test_asset_operations','reject_maintenance_report','resolve_pam_report_match',
    'revert_asset_import_batch','set_asset_profile_photo','set_own_profile_avatar','update_asset_record',
    'update_own_push_notification_preferences','upsert_own_push_subscription'
  ])
order by p.proname, signature;

-- 9) Funções SECURITY DEFINER usadas pelo frontend devem ser revisadas quanto ao search_path.
select
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname = any(array[
    'apply_asset_bulk_update','approve_maintenance_report','clear_own_password_change_requirement',
    'complete_pam_from_approved_report','correct_maintenance_report','deactivate_own_push_subscription',
    'finalize_verified_self_signup','mark_all_notifications_read','mark_notification_read',
    'purge_test_asset_operations','reject_maintenance_report','resolve_pam_report_match',
    'revert_asset_import_batch','set_asset_profile_photo','set_own_profile_avatar','update_asset_record',
    'update_own_push_notification_preferences','upsert_own_push_subscription'
  ])
order by p.proname,signature;


-- 10) Helper interno de atualização de ativos não deve ser executável diretamente por anon/authenticated.
select
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('is_admin','apply_asset_update_internal')
order by p.proname;
