-- Central de Manutenção SE v1.9.0 — PRECHECK somente leitura
-- Execute antes de 20260814_corporate_hardening.sql.

-- 1) Tabelas obrigatórias. Todas devem retornar existe = true.
with required(table_name) as (
  values
    ('profiles'),('substations'),('assets'),('asset_families'),
    ('maintenance_reports'),('maintenance_report_assets'),('maintenance_parts'),('maintenance_photos'),('audit_logs'),
    ('asset_operations'),('maintenance_plan_items'),('asset_import_batches'),('asset_audit_logs')
)
select table_name, to_regclass('public.'||table_name) is not null as existe
from required
order by table_name;

-- 2) Colunas usadas pelo hardening/PAM. Nenhuma linha deve retornar false.
with required(table_name,column_name) as (
  values
    ('profiles','id'),('profiles','display_name'),('profiles','role'),('profiles','active'),('profiles','approval_status'),('profiles','avatar_path'),
    ('maintenance_reports','id'),('maintenance_reports','author_id'),
    ('maintenance_report_assets','report_id'),('maintenance_parts','report_id'),('maintenance_photos','report_id'),
    ('audit_logs','actor_id'),('audit_logs','report_id'),('asset_operations','author_id'),
    ('maintenance_plan_items','id'),('maintenance_plan_items','source_row'),('maintenance_plan_items','region'),
    ('maintenance_plan_items','substation_ref'),('maintenance_plan_items','locality'),('maintenance_plan_items','item_group'),
    ('maintenance_plan_items','plant_structure'),('maintenance_plan_items','sgd_key'),('maintenance_plan_items','planned_for'),
    ('maintenance_plan_items','service_description'),('maintenance_plan_items','quantity'),
    ('maintenance_plan_items','source_execution_date'),('maintenance_plan_items','source_status'),('maintenance_plan_items','completion_date')
)
select r.table_name,r.column_name,(c.column_name is not null) as existe
from required r
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;

-- 3) Buckets utilizados pela aplicação.
select x.bucket_id,(b.id is not null) as existe,coalesce(b.public,false) as public_atual
from (values ('user-profile-photos'),('asset-profile-photos'),('maintenance-photos')) x(bucket_id)
left join storage.buckets b on b.id=x.bucket_id
order by x.bucket_id;

-- 4) Volume atual, apenas para conferência.
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.substations) as substations,
  (select count(*) from public.assets) as assets,
  (select count(*) from public.maintenance_reports) as reports,
  (select count(*) from public.maintenance_plan_items) as pam_rows;

-- 5) RPCs chamados pelo frontend. A lista pode ter mais de uma linha por função se houver overload.
select p.proname,p.oid::regprocedure::text as signature,p.prosecdef as security_definer
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
