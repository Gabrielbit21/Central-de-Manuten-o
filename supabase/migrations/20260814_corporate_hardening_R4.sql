-- Central de Manutenção SE v1.9.0 — Corporate Ready / Security Hardening R4
-- Data: 2026-08-14
-- Revisão R4: arquivo com nome único para evitar cache/reuso da revisão anterior; mantém casts explícitos das datas do seed PAM.
-- Objetivos:
--   1) consolidar RLS e privilégios mínimos para o frontend autenticado;
--   2) separar o diretório público-interno de perfis dos dados cadastrais privados;
--   3) reforçar Storage privado;
--   4) garantir que o PAM exista no Supabase antes de remover o seed do frontend.
--
-- Execute somente depois de estar com a v1.8.2 funcional no projeto atual.

begin;

-- ===== Preflight: o hardening parte do schema funcional da v1.8.2 =====
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Hardening v1.9.0 abortado: tabela public.% não existe.', t;
    end if;
  end loop;
end $$;

-- ===== Backup automático da configuração de segurança anterior =====
-- Mantido no banco para permitir rollback controlado se a homologação v1.9.0 detectar regressão.
create table if not exists public.central_security_backup_v190 (
  id bigserial primary key,
  kind text not null,
  object_key text not null,
  ddl text,
  value_json jsonb,
  created_at timestamptz not null default now()
);
revoke all on table public.central_security_backup_v190 from public, anon, authenticated;
grant select, insert, update, delete on table public.central_security_backup_v190 to service_role;

-- Faz o snapshot apenas uma vez, preservando o estado anterior à primeira execução da v1.9.0.
do $$
begin
  if not exists (select 1 from public.central_security_backup_v190) then
    insert into public.central_security_backup_v190(kind,object_key,ddl)
    select
      'policy',
      n.nspname || '.' || c.relname || '.' || p.polname,
      format(
        'create policy %I on %I.%I as %s for %s to %s%s%s;',
        p.polname,
        n.nspname,
        c.relname,
        case when p.polpermissive then 'permissive' else 'restrictive' end,
        case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
        coalesce((select string_agg(case when role_oid=0 then 'public' else quote_ident(pg_get_userbyid(role_oid)) end, ', ')
                    from unnest(p.polroles) role_oid),'public'),
        case when p.polqual is not null then ' using (' || pg_get_expr(p.polqual,p.polrelid) || ')' else '' end,
        case when p.polwithcheck is not null then ' with check (' || pg_get_expr(p.polwithcheck,p.polrelid) || ')' else '' end
      )
    from pg_policy p
    join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where (
      n.nspname='public' and c.relname = any(array[
        'profiles','substations','assets','asset_families',
        'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
        'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
      ])
    ) or (
      n.nspname='storage' and c.relname='objects'
      and (coalesce(pg_get_expr(p.polqual,p.polrelid),'') || ' ' || coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''))
        ~* '(user-profile-photos|asset-profile-photos|maintenance-photos)'
    );

    insert into public.central_security_backup_v190(kind,object_key,ddl)
    select
      'grant',
      table_schema || '.' || table_name || '.' || grantee || '.' || privilege_type,
      format('grant %s on table %I.%I to %I;', lower(privilege_type), table_schema, table_name, grantee)
    from information_schema.role_table_grants
    where table_schema='public'
      and grantee in ('anon','authenticated')
      and table_name = any(array[
        'profiles','substations','assets','asset_families',
        'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
        'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
      ]);

    -- Snapshot dos privilégios EXECUTE efetivos das funções que serão endurecidas.
    insert into public.central_security_backup_v190(kind,object_key,value_json)
    select
      'function_grant',
      p.oid::regprocedure::text,
      jsonb_build_object(
        'anon', has_function_privilege('anon',p.oid,'EXECUTE'),
        'authenticated', has_function_privilege('authenticated',p.oid,'EXECUTE'),
        'service_role', has_function_privilege('service_role',p.oid,'EXECUTE')
      )
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'apply_asset_bulk_update','approve_maintenance_report','clear_own_password_change_requirement',
        'complete_pam_from_approved_report','correct_maintenance_report','deactivate_own_push_subscription',
        'finalize_verified_self_signup','mark_all_notifications_read','mark_notification_read',
        'purge_test_asset_operations','reject_maintenance_report','resolve_pam_report_match',
        'revert_asset_import_batch','set_asset_profile_photo','set_own_profile_avatar','update_asset_record',
        'update_own_push_notification_preferences','upsert_own_push_subscription',
        'is_admin','apply_asset_update_internal'
      ]);

    insert into public.central_security_backup_v190(kind,object_key,value_json)
    select 'bucket', id, jsonb_build_object('id',id,'public',public)
      from storage.buckets
     where id in ('user-profile-photos','asset-profile-photos','maintenance-photos');
  end if;
end $$;

-- ===== Helpers de autorização =====
create or replace function public.central_is_active_user(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_uid
       and coalesce(p.active,false) = true
       and coalesce(p.approval_status,'approved') = 'approved'
  );
$$;

create or replace function public.central_is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = p_uid
       and coalesce(p.active,false) = true
       and coalesce(p.approval_status,'approved') = 'approved'
       and p.role = 'admin'
  );
$$;

revoke all on function public.central_is_active_user(uuid) from public, anon;
revoke all on function public.central_is_admin(uuid) from public, anon;
grant execute on function public.central_is_active_user(uuid) to authenticated, service_role;
grant execute on function public.central_is_admin(uuid) to authenticated, service_role;

-- Helpers legados verificados no PRECHECK: is_admin() valida role/active/approved.
-- O helper interno de atualização de ativos nunca deve ser chamado diretamente pelo frontend.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.apply_asset_update_internal(text,bigint,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.apply_asset_update_internal(text,bigint,jsonb,uuid,text) to service_role;

-- ===== Diretório seguro de perfis =====
-- O frontend não precisa carregar telefone/preferências dos demais usuários.
drop view if exists public.profile_directory;
create view public.profile_directory as
select p.id, p.display_name, p.role, p.active, p.avatar_path
  from public.profiles p
 where public.central_is_active_user(auth.uid());

revoke all on public.profile_directory from public, anon;
grant select on public.profile_directory to authenticated, service_role;

-- ===== RLS: remove políticas antigas das tabelas operacionais e aplica contrato mínimo =====
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for pol in
        select polname from pg_policy where polrelid = to_regclass('public.' || t)
      loop
        execute format('drop policy if exists %I on public.%I', pol.polname, t);
      end loop;
    end if;
  end loop;
end $$;

-- Perfis: cada usuário lê somente seu cadastro completo.
create policy central_profiles_select_self
on public.profiles for select to authenticated
using (id = auth.uid());

-- Catálogo operacional: somente usuários ativos autenticados.
create policy central_substations_select_active
on public.substations for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_assets_select_active
on public.assets for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_asset_families_select_active
on public.asset_families for select to authenticated
using (public.central_is_active_user(auth.uid()));

-- Relatórios: histórico legível pela equipe autenticada; criação limitada ao próprio autor.
create policy central_reports_select_active
on public.maintenance_reports for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_reports_insert_own
on public.maintenance_reports for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and author_id = auth.uid()
);

create policy central_report_assets_select_active
on public.maintenance_report_assets for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_report_assets_insert_own_report
on public.maintenance_report_assets for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and exists (
    select 1 from public.maintenance_reports r
     where r.id = report_id and r.author_id = auth.uid()
  )
);

create policy central_parts_select_active
on public.maintenance_parts for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_parts_insert_own_report
on public.maintenance_parts for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and exists (
    select 1 from public.maintenance_reports r
     where r.id = report_id and r.author_id = auth.uid()
  )
);

create policy central_photos_select_active
on public.maintenance_photos for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_photos_insert_own_report
on public.maintenance_photos for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and exists (
    select 1 from public.maintenance_reports r
     where r.id = report_id and r.author_id = auth.uid()
  )
);

create policy central_audit_select_active
on public.audit_logs for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_audit_insert_own
on public.audit_logs for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and actor_id = auth.uid()
  and exists (
    select 1 from public.maintenance_reports r
     where r.id = report_id and (r.author_id = auth.uid() or public.central_is_admin(auth.uid()))
  )
);

-- Integração / substituição.
create policy central_asset_operations_select_active
on public.asset_operations for select to authenticated
using (public.central_is_active_user(auth.uid()));

create policy central_asset_operations_insert_own
on public.asset_operations for insert to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and author_id = auth.uid()
);

-- PAM: leitura para usuários ativos. Alterações permanecem via RPC controlada.
create policy central_plan_select_active
on public.maintenance_plan_items for select to authenticated
using (public.central_is_active_user(auth.uid()));

-- Auditoria/importação de ativos: somente administração.
create policy central_import_batches_select_admin
on public.asset_import_batches for select to authenticated
using (public.central_is_admin(auth.uid()));

create policy central_asset_audit_select_admin
on public.asset_audit_logs for select to authenticated
using (public.central_is_admin(auth.uid()));

-- ===== Privilégios mínimos das tabelas =====
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.substations from anon, authenticated;
grant select on table public.substations to authenticated;

revoke all on table public.assets from anon, authenticated;
grant select on table public.assets to authenticated;

revoke all on table public.asset_families from anon, authenticated;
grant select on table public.asset_families to authenticated;

revoke all on table public.maintenance_reports from anon, authenticated;
grant select, insert on table public.maintenance_reports to authenticated;

revoke all on table public.maintenance_report_assets from anon, authenticated;
grant select, insert on table public.maintenance_report_assets to authenticated;

revoke all on table public.maintenance_parts from anon, authenticated;
grant select, insert on table public.maintenance_parts to authenticated;

revoke all on table public.maintenance_photos from anon, authenticated;
grant select, insert on table public.maintenance_photos to authenticated;

revoke all on table public.audit_logs from anon, authenticated;
grant select, insert on table public.audit_logs to authenticated;

revoke all on table public.asset_operations from anon, authenticated;
grant select, insert on table public.asset_operations to authenticated;

revoke all on table public.maintenance_plan_items from anon, authenticated;
grant select on table public.maintenance_plan_items to authenticated;

revoke all on table public.asset_import_batches from anon, authenticated;
grant select on table public.asset_import_batches to authenticated;

revoke all on table public.asset_audit_logs from anon, authenticated;
grant select on table public.asset_audit_logs to authenticated;

-- ===== RPCs usados pelo frontend: nunca executáveis como anon/PUBLIC =====
-- Administradores e Equipe de Campo compartilham o papel PostgreSQL `authenticated`;
-- as RPCs administrativas validadas no PRECHECK aplicam public.is_admin() internamente.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
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
  loop
    execute format('revoke all on function %s from public, anon', fn.oid::regprocedure);
    execute format('grant execute on function %s to authenticated, service_role', fn.oid::regprocedure);
  end loop;
end $$;

-- ===== Storage: buckets privados e políticas explícitas =====
update storage.buckets
   set public = false
 where id in ('user-profile-photos','asset-profile-photos','maintenance-photos');

do $$
declare
  pol record;
  q text;
begin
  for pol in
    select p.polname,
           pg_get_expr(p.polqual,p.polrelid) as using_expr,
           pg_get_expr(p.polwithcheck,p.polrelid) as check_expr
      from pg_policy p
     where p.polrelid = 'storage.objects'::regclass
  loop
    q := coalesce(pol.using_expr,'') || ' ' || coalesce(pol.check_expr,'');
    if q ilike '%user-profile-photos%'
       or q ilike '%asset-profile-photos%'
       or q ilike '%maintenance-photos%' then
      execute format('drop policy if exists %I on storage.objects', pol.polname);
    end if;
  end loop;
end $$;

create policy central_storage_user_profile_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'user-profile-photos'
  and split_part(name,'/',1) = auth.uid()::text
);
create policy central_storage_user_profile_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-profile-photos'
  and public.central_is_active_user(auth.uid())
  and split_part(name,'/',1) = auth.uid()::text
);
create policy central_storage_user_profile_update_own
on storage.objects for update to authenticated
using (bucket_id = 'user-profile-photos' and split_part(name,'/',1) = auth.uid()::text)
with check (bucket_id = 'user-profile-photos' and split_part(name,'/',1) = auth.uid()::text);
create policy central_storage_user_profile_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'user-profile-photos' and split_part(name,'/',1) = auth.uid()::text);

create policy central_storage_asset_profile_select_active
on storage.objects for select to authenticated
using (bucket_id = 'asset-profile-photos' and public.central_is_active_user(auth.uid()));
create policy central_storage_asset_profile_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'asset-profile-photos' and public.central_is_active_user(auth.uid()) and split_part(name,'/',1) = auth.uid()::text);
create policy central_storage_asset_profile_update_own
on storage.objects for update to authenticated
using (bucket_id = 'asset-profile-photos' and split_part(name,'/',1) = auth.uid()::text)
with check (bucket_id = 'asset-profile-photos' and split_part(name,'/',1) = auth.uid()::text);
create policy central_storage_asset_profile_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'asset-profile-photos' and split_part(name,'/',1) = auth.uid()::text);

create policy central_storage_maintenance_select_active
on storage.objects for select to authenticated
using (bucket_id = 'maintenance-photos' and public.central_is_active_user(auth.uid()));
create policy central_storage_maintenance_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'maintenance-photos' and public.central_is_active_user(auth.uid()) and split_part(name,'/',1) = auth.uid()::text);
create policy central_storage_maintenance_update_own
on storage.objects for update to authenticated
using (bucket_id = 'maintenance-photos' and split_part(name,'/',1) = auth.uid()::text)
with check (bucket_id = 'maintenance-photos' and split_part(name,'/',1) = auth.uid()::text);
create policy central_storage_maintenance_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'maintenance-photos' and split_part(name,'/',1) = auth.uid()::text);

-- ===== PAM: garante dados em nuvem antes de remover fallback estático do frontend =====
-- Insere somente linhas ausentes. Não sobrescreve status/app vinculado já existente.
insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0002',2,'CTZ','SEDE','CATAGUASES','Painéis de Automação','Sala Elétrica','Painel','2026-02-19','AT027 - Manutenção preventiva - painel de automação',3,'2026-03-02','Concluído',null),
  ('PAM2026-0003',3,'CTZ','SEDE','CATAGUASES','Serviços Essenciais','Sala Elétrica','Painel','2026-02-19','AT038 - Manutenção preventiva - retificador',3,'2026-03-02','Concluído',null),
  ('PAM2026-0004',4,'CTZ','SEDE','CATAGUASES','Painéis de Automação','Sala Elétrica','Painel','2026-08-01','AT027 - Manutenção preventiva - painel de automação',3,'2026-03-02','Concluído',null),
  ('PAM2026-0005',5,'CTZ','SEDE','CATAGUASES','Serviços Essenciais','Sala Elétrica','Painel','2026-08-01','AT038 - Manutenção preventiva - retificador',3,'2026-03-02','Concluído',null),
  ('PAM2026-0006',6,'CTZ','Chaveamento ASD/RDR (2903 e 2904) - Derivação RDR','CATAGUASES','Chave motorizada','C50','2903 e 2904','2026-08-01','AT026 - Manutenção preventiva - chave motorizada',1,'2026-08-07','Em Execução',null),
  ('PAM2026-0007',7,'CTZ','Chaveamento CIC (2911 e 2912)','CATAGUASES','Chave motorizada','C50','2911 e 2912','2026-08-01','AT026 - Manutenção preventiva - chave motorizada',1,'2026-07-31','Em Execução',null),
  ('PAM2026-0008',8,'CTZ','Chaveamento CTZ2/MRE1/LRJ/MRI (2901, 2902, 2913 e 2914)','CATAGUASES','Chave motorizada','C50','2901, 2902, 2913 e 2914','2026-01-26','AT026 - Manutenção preventiva - chave motorizada',1,'2026-08-11','Programado',null),
  ('PAM2026-0009',9,'CTZ','Chaveamento NUM/UBÁ1 (2905 e 2906) - Derivação RDR','LEOPOLDINA','Chave motorizada','C50','2905 e 2906','2026-06-01','AT026 - Manutenção preventiva - chave motorizada',1,'2026-08-14','Programado',null),
  ('PAM2026-0010',10,'MAU','Chaveamento REA (2925 e 2926)','REALEZA','Chave motorizada','C50','2925 e 2926','2026-05-01','AT026 - Manutenção preventiva - chave motorizada',1,null,'Não Programado',null),
  ('PAM2026-0011',11,'CTZ','Chaveamento SE GCM (2902)','GUIRICEMA','Chave motorizada','C50','2902','2026-04-01','AT026 - Manutenção preventiva - chave motorizada',1,null,'Não Programado',null),
  ('PAM2026-0012',12,'MAU','Chaveamento SE SAM (2918 e 2919)','SANTANA DO MANHUAÇU','Chave motorizada','C50','2918 e 2919','2026-05-01','AT026 - Manutenção preventiva - chave motorizada',1,null,'Não Programado',null),
  ('PAM2026-0013',13,'CTZ','Chaveamento Sericita/Pedra do Anta (2915 e 2916)','SERICITA','Chave motorizada','C50','2915 e 2916','2026-09-01','AT026 - Manutenção preventiva - chave motorizada',1,null,'Não Programado',null),
  ('PAM2026-0014',14,'UBA','Chaveamento UBÁ1/VRB2/DVN (2909 e 2910)','UBA','Chave motorizada','C50','2909 e 2910','2026-04-01','AT026 - Manutenção preventiva - chave motorizada',1,null,'Não Programado',null),
  ('PAM2026-0015',15,'CTZ','Chaveamento CTZ PAPEL (2907 e 2908)','CATAGUASES','Chave motorizada','C50','2907 e 2908','2026-02-23','AT026 - Manutenção preventiva - chave motorizada',1,'2026-02-27','Concluído',null),
  ('PAM2026-0016',16,'CTZ','ALP','ALÉM PARAÍBA','Painéis de Automação','RTAC','Rtac','2026-01-19','AT027 - Manutenção preventiva - painel de automação',1,'2026-01-19','Concluído',null),
  ('PAM2026-0017',17,'CTZ','ALP','ALÉM PARAÍBA','Regulador de Subestação','RT3-1','9702','2026-01-19','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-01-19','Concluído',null),
  ('PAM2026-0018',18,'CTZ','ALP','ALÉM PARAÍBA','Relé','BC','5207','2026-01-20','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-01-20','Concluído',null),
  ('PAM2026-0019',19,'CTZ','ALP','ALÉM PARAÍBA','Relé','LDAT LPD2','5204','2026-01-20','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-20','Concluído',null),
  ('PAM2026-0020',20,'CTZ','ALP','ALÉM PARAÍBA','Relé','LDAT LPD','5205','2026-01-21','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-21','Concluído',null),
  ('PAM2026-0021',21,'CTZ','ALP','ALÉM PARAÍBA','Relé','TF 138/69KV','9701','2026-01-22','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-01-22','Concluído',null),
  ('PAM2026-0022',22,'CTZ','ALP','ALÉM PARAÍBA','Relé','TF 69/11,4KV','9702','2026-01-22','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-01-22','Concluído',null),
  ('PAM2026-0023',23,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP1','9601','2026-01-20','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-20','Concluído',null),
  ('PAM2026-0024',24,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP2','9602','2026-01-20','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-20','Concluído',null),
  ('PAM2026-0025',25,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP3','9603','2026-01-21','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-21','Concluído',null),
  ('PAM2026-0026',26,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP4','9604','2026-01-21','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-21','Concluído',null),
  ('PAM2026-0027',27,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP5','9605','2026-01-22','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-22','Concluído',null),
  ('PAM2026-0028',28,'CTZ','ALP','ALÉM PARAÍBA','Religador de Subestação','RL ALP6','9606','2026-01-22','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-22','Concluído',null),
  ('PAM2026-0029',29,'CTZ','ALP','ALÉM PARAÍBA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-01-19','AT038 - Manutenção preventiva - retificador',1,'2026-01-19','Concluído',null),
  ('PAM2026-0030',30,'CTZ','ASD','ASTOLFO DUTRA','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-06-25','Concluído',null),
  ('PAM2026-0031',31,'CTZ','ASD','ASTOLFO DUTRA','Regulador de Subestação','RUA','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-05-25','Concluído',null),
  ('PAM2026-0032',32,'CTZ','ASD','ASTOLFO DUTRA','Relé','BC','5202','2026-09-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-26','Concluído',null),
  ('PAM2026-0033',33,'CTZ','ASD','ASTOLFO DUTRA','Relé','TF 69/11,4KV','9701','2026-09-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-05-26','Concluído',null),
  ('PAM2026-0034',34,'CTZ','ASD','ASTOLFO DUTRA','Religador de Subestação','RL ASD1','9602','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0035',35,'CTZ','ASD','ASTOLFO DUTRA','Religador de Subestação','RL ASD2','9604','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0036',36,'CTZ','ASD','ASTOLFO DUTRA','Religador de Subestação','RL DEB','9603','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0037',37,'CTZ','ASD','ASTOLFO DUTRA','Religador de Subestação','RL TFO','9605','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0038',38,'CTZ','ASD','ASTOLFO DUTRA','Religador de Subestação','RL SBP','9601','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0039',39,'CTZ','ASD','ASTOLFO DUTRA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-05-27','Concluído',null),
  ('PAM2026-0040',40,'UBA','CBA','COIMBRA','Painéis de Automação','C50','Concentrador','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-10','Concluído','2026-07-08'),
  ('PAM2026-0041',41,'UBA','CBA','COIMBRA','Regulador de Subestação','RUA','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-10','Concluído','2026-07-08'),
  ('PAM2026-0042',42,'UBA','CBA','COIMBRA','Relé','BC','5201','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-09','Concluído','2026-07-09'),
  ('PAM2026-0043',43,'UBA','CBA','COIMBRA','Relé','TF 69/11,4KV','9701','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-10','Concluído','2026-07-09'),
  ('PAM2026-0044',44,'UBA','CBA','COIMBRA','Religador de Subestação','RL CBA1','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-09'),
  ('PAM2026-0045',45,'UBA','CBA','COIMBRA','Religador de Subestação','RL CBA2','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-08','Concluído','2026-07-08'),
  ('PAM2026-0046',46,'UBA','CBA','COIMBRA','Religador de Subestação','RL CBA3','9605','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-08'),
  ('PAM2026-0047',47,'UBA','CBA','COIMBRA','Religador de Subestação','RL CJI','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-08'),
  ('PAM2026-0048',48,'UBA','CBA','COIMBRA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-04-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-10','Concluído','2026-07-08'),
  ('PAM2026-0049',49,'NVF','CET','LUMIAR','Regulador de Subestação','RUA','Relé','2026-02-02','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-02-02','Concluído',null),
  ('PAM2026-0050',50,'NVF','CET','LUMIAR','Relé','BC','5202','2026-02-02','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-02-02','Concluído',null),
  ('PAM2026-0051',51,'NVF','CET','LUMIAR','Relé','TF 138/11,4KV','9701','2026-02-11','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-02-11','Concluído',null),
  ('PAM2026-0052',52,'NVF','CET','LUMIAR','Religador de Subestação','RL LUM4','9603','2026-02-11','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-11','Concluído',null),
  ('PAM2026-0053',53,'NVF','CET','LUMIAR','Religador de Subestação','RL LUM2','9601','2026-02-11','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-11','Concluído',null),
  ('PAM2026-0054',54,'NVF','CET','LUMIAR','Religador de Subestação','RL LUM3','9602','2026-02-11','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-11','Concluído',null),
  ('PAM2026-0055',55,'NVF','CET','LUMIAR','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-02-02','AT038 - Manutenção preventiva - retificador',1,'2026-02-02','Concluído',null),
  ('PAM2026-0056',56,'NVF','CPO','NOVA FRIBURGO','Painéis de Automação','C50','Concentrador','2026-01-12','AT027 - Manutenção preventiva - painel de automação',1,'2026-02-02','Concluído',null),
  ('PAM2026-0057',57,'NVF','CPO','NOVA FRIBURGO','Regulador de Subestação','RT3-1','9701','2026-01-12','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-01-12','Concluído',null),
  ('PAM2026-0058',58,'NVF','CPO','NOVA FRIBURGO','Relé','BC','5211','2026-01-12','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-01-12','Concluído',null),
  ('PAM2026-0059',59,'NVF','CPO','NOVA FRIBURGO','Relé','LDAT 69kV JAP','5202','2026-01-12','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-12','Concluído',null),
  ('PAM2026-0060',60,'NVF','CPO','NOVA FRIBURGO','Relé','LDAT 69kV SUM','5203','2026-01-13','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-13','Concluído',null),
  ('PAM2026-0061',61,'NVF','CPO','NOVA FRIBURGO','Relé','LDAT 69kV TAO','5201','2026-01-13','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-13','Concluído',null),
  ('PAM2026-0062',62,'NVF','CPO','NOVA FRIBURGO','Relé','TF 69/11,4KV','9701','2026-01-13','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-01-13','Concluído',null),
  ('PAM2026-0063',63,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL CPO1','5205','2026-01-13','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-13','Concluído',null),
  ('PAM2026-0064',64,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL CTE','5206','2026-01-14','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-08','Concluído',null),
  ('PAM2026-0065',65,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL FVO','5207','2026-01-14','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-14','Concluído',null),
  ('PAM2026-0066',66,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL PRD','5208','2026-01-15','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-15','Concluído',null),
  ('PAM2026-0067',67,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL RGC2','5209','2026-01-15','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-15','Concluído',null),
  ('PAM2026-0068',68,'NVF','CPO','NOVA FRIBURGO','Religador de Subestação','RL JOP','5210','2026-01-16','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-16','Concluído',null),
  ('PAM2026-0069',69,'NVF','CPO','NOVA FRIBURGO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-01-16','AT038 - Manutenção preventiva - retificador',1,'2026-01-16','Concluído',null),
  ('PAM2026-0070',70,'NVF','CQT','NOVA FRIBURGO','Painéis de Automação','RTAC','Rtac','2026-02-06','AT027 - Manutenção preventiva - painel de automação',1,'2026-02-06','Concluído',null),
  ('PAM2026-0071',71,'NVF','CQT','NOVA FRIBURGO','Regulador de Subestação','2414','9701','2026-02-06','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-02-06','Concluído',null),
  ('PAM2026-0072',72,'NVF','CQT','NOVA FRIBURGO','Relé','BC1','5202','2026-02-04','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-02-04','Concluído',null),
  ('PAM2026-0073',73,'NVF','CQT','NOVA FRIBURGO','Relé','BC2','5206','2026-02-04','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-02-04','Concluído',null),
  ('PAM2026-0074',74,'NVF','CQT','NOVA FRIBURGO','Relé','BC3','5207','2026-02-04','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-02-04','Concluído',null),
  ('PAM2026-0075',75,'NVF','CQT','NOVA FRIBURGO','Relé','LDAT AMPLA','5201','2026-02-04','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-02-04','Concluído',null),
  ('PAM2026-0076',76,'NVF','CQT','NOVA FRIBURGO','Relé','TF 138/11,4KV','9701','2026-02-05','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-02-05','Concluído',null),
  ('PAM2026-0077',77,'NVF','CQT','NOVA FRIBURGO','Religador de Subestação','RL CQT2','5203','2026-02-05','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-05','Concluído',null),
  ('PAM2026-0078',78,'NVF','CQT','NOVA FRIBURGO','Religador de Subestação','RL CQT3',null,'2026-02-05','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-05','Concluído',null),
  ('PAM2026-0079',79,'NVF','CQT','NOVA FRIBURGO','Religador de Subestação','RL CQT4','5205','2026-02-05','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-05','Concluído',null),
  ('PAM2026-0080',80,'NVF','CQT','NOVA FRIBURGO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-02-06','AT038 - Manutenção preventiva - retificador',1,'2026-02-06','Concluído',null),
  ('PAM2026-0081',81,'CTZ','CTZ1','CATAGUASES','Painéis de Automação','RTAC','Rtac','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0082',82,'CTZ','CTZ1','CATAGUASES','Regulador de Subestação','RT3-2','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0083',83,'CTZ','CTZ1','CATAGUASES','Relé','BC','5203','2026-06-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0084',84,'CTZ','CTZ1','CATAGUASES','Relé','LDAT CTZ2','5201','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0085',85,'CTZ','CTZ1','CATAGUASES','Relé','TF69/22KV','9701','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0086',86,'CTZ','CTZ1','CATAGUASES','Religador de Subestação','RL VMI','9603','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0087',87,'CTZ','CTZ1','CATAGUASES','Religador de Subestação','RL GJA','9602','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0088',88,'CTZ','CTZ1','CATAGUASES','Religador de Subestação','RL TME','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0089',89,'CTZ','CTZ1','CATAGUASES','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-06-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0090',90,'CTZ','CTZ2','CATAGUASES','Painéis de Automação','ELIPSE','Painel','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0091',91,'CTZ','CTZ2','CATAGUASES','Regulador de Subestação','SEL 2414','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null)
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0092',92,'CTZ','CTZ2','CATAGUASES','Relé','BC','5210','2026-06-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0093',93,'CTZ','CTZ2','CATAGUASES','Relé','BC','5212','2026-06-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0094',94,'CTZ','CTZ2','CATAGUASES','Relé','LDAT ALP','5203','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0095',95,'CTZ','CTZ2','CATAGUASES','Relé','LDAT CTZ1','5205','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0096',96,'CTZ','CTZ2','CATAGUASES','Relé','LDAT MRE1','5208','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0097',97,'CTZ','CTZ2','CATAGUASES','Relé','LDAT NUM','5202','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0098',98,'CTZ','CTZ2','CATAGUASES','Relé','LDAT UBR','5211','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0099',99,'CTZ','CTZ2','CATAGUASES','Relé','TF 138/22KV','9704','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0100',100,'CTZ','CTZ2','CATAGUASES','Relé','TF 138/69KV','9701','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0101',101,'CTZ','CTZ2','CATAGUASES','Religador de Subestação','RL TQP','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0102',102,'CTZ','CTZ2','CATAGUASES','Religador de Subestação','RL BRIO','9606','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0103',103,'CTZ','CTZ2','CATAGUASES','Religador de Subestação','RL IND','9604','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0104',104,'CTZ','CTZ2','CATAGUASES','Religador de Subestação','RL MRI','9605','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0105',105,'CTZ','CTZ2','CATAGUASES','Religador de Subestação','RL STC','9603','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0106',106,'CTZ','CTZ2','CATAGUASES','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-06-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0107',107,'UBA','DVN','DIVINÉSIA','Painéis de Automação','C50','Concentrador','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-14','Concluído','2026-07-14'),
  ('PAM2026-0108',108,'UBA','DVN','DIVINÉSIA','Regulador de Subestação','RUA','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-14','Concluído','2026-07-14'),
  ('PAM2026-0109',109,'UBA','DVN','DIVINÉSIA','Relé','BC','5202','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-14','Concluído','2026-07-14'),
  ('PAM2026-0110',110,'UBA','DVN','DIVINÉSIA','Relé','TF 69/11,4KV','9701','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-14','Concluído','2026-07-14'),
  ('PAM2026-0111',111,'UBA','DVN','DIVINÉSIA','Religador de Subestação','RL SNF','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-15','Concluído','2026-07-15'),
  ('PAM2026-0112',112,'UBA','DVN','DIVINÉSIA','Religador de Subestação','RL DVN','9601','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-15','Concluído','2026-07-15'),
  ('PAM2026-0113',113,'UBA','DVN','DIVINÉSIA','Religador de Subestação','RL PLC','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-15','Concluído','2026-07-15'),
  ('PAM2026-0114',114,'UBA','DVN','DIVINÉSIA','Religador de Subestação','RL SNF2','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-15','Concluído','2026-07-15'),
  ('PAM2026-0115',115,'UBA','DVN','DIVINÉSIA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-04-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-14','Concluído','2026-07-14'),
  ('PAM2026-0116',116,'MRE','ENP','EUGENÓPOLIS','Painéis de Automação','C50','Concentrador','2026-03-31','AT027 - Manutenção preventiva - painel de automação',1,'2026-03-31','Concluído',null),
  ('PAM2026-0117',117,'MRE','ENP','EUGENÓPOLIS','Regulador de Subestação','2414','Relé','2026-03-31','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-03-31','Concluído',null),
  ('PAM2026-0118',118,'MRE','ENP','EUGENÓPOLIS','Relé','BC1','5202','2026-03-31','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-03-31','Concluído',null),
  ('PAM2026-0119',119,'MRE','ENP','EUGENÓPOLIS','Relé','BC2','5203','2026-03-31','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-03-31','Concluído',null),
  ('PAM2026-0120',120,'MRE','ENP','EUGENÓPOLIS','Relé','TF 69/11,4KV','Relé','2026-03-31','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-03-31','Concluído',null),
  ('PAM2026-0121',121,'MRE','ENP','EUGENÓPOLIS','Religador de Subestação','RL APM','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-03-31','Concluído',null),
  ('PAM2026-0122',122,'MRE','ENP','EUGENÓPOLIS','Religador de Subestação','RL BMA','9601','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0123',123,'MRE','ENP','EUGENÓPOLIS','Religador de Subestação','RL ENP','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0124',124,'MRE','ENP','EUGENÓPOLIS','Religador de Subestação','RL PTM','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0125',125,'MRE','ENP','EUGENÓPOLIS','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-03-31','AT038 - Manutenção preventiva - retificador',1,'2026-03-31','Concluído',null),
  ('PAM2026-0126',126,'CTZ','GNI','GUARANI','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0127',127,'CTZ','GNI','GUARANI','Regulador de Subestação','R.U.A-01','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0128',128,'CTZ','GNI','GUARANI','Relé','TF 22/11,4KV','9701','2026-09-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0129',129,'CTZ','GNI','GUARANI','Religador de Subestação','RL GNI1','9601','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0130',130,'CTZ','GNI','GUARANI','Religador de Subestação','RL GNI2','9602','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0131',131,'CTZ','GNI','GUARANI','Religador de Subestação','RL TRAFO','5201','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0132',132,'CTZ','GNI','GUARANI','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-16','Concluído','2026-07-16'),
  ('PAM2026-0133',133,'NVF','JAP','NOVA FRIBURGO','Painéis de Automação','C50','Concentrador','2026-02-09','AT027 - Manutenção preventiva - painel de automação',1,'2026-02-09','Concluído',null),
  ('PAM2026-0134',134,'NVF','JAP','NOVA FRIBURGO','Regulador de Subestação','RT3-2','9701','2026-02-09','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-02-09','Concluído',null),
  ('PAM2026-0135',135,'NVF','JAP','NOVA FRIBURGO','Religador de Subestação','RL LUM','5210','2026-02-10','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-10','Concluído',null),
  ('PAM2026-0136',136,'NVF','JAP','NOVA FRIBURGO','Relé','BC','5211','2026-02-10','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-02-10','Concluído',null),
  ('PAM2026-0137',137,'NVF','JAP','NOVA FRIBURGO','Relé','LDAT CPO','5201','2026-02-10','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-02-10','Concluído',null),
  ('PAM2026-0138',138,'NVF','JAP','NOVA FRIBURGO','Relé','LDAT TAO','5202','2026-02-10','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-02-10','Concluído',null),
  ('PAM2026-0139',139,'NVF','JAP','NOVA FRIBURGO','Relé','TF 69/11,4KV','9701','2026-02-10','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-02-10','Concluído',null),
  ('PAM2026-0140',140,'NVF','JAP','NOVA FRIBURGO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','RETIFICADOR','2026-02-09','AT038 - Manutenção preventiva - retificador',1,'2026-02-09','Concluído',null),
  ('PAM2026-0141',141,'CTZ','LPD1','LEOPOLDINA','Painéis de Automação','RTAC','Rtac','2026-01-06','AT027 - Manutenção preventiva - painel de automação',1,'2026-01-06','Concluído',null),
  ('PAM2026-0142',142,'CTZ','LPD1','LEOPOLDINA','Regulador de Subestação','RT3-1','9702','2026-01-06','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-01-06','Concluído',null),
  ('PAM2026-0143',143,'CTZ','LPD1','LEOPOLDINA','Relé','BC1','5206','2026-01-06','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-01-06','Concluído',null),
  ('PAM2026-0144',144,'CTZ','LPD1','LEOPOLDINA','Relé','BC2','5207','2026-01-06','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-01-06','Concluído',null),
  ('PAM2026-0145',145,'CTZ','LPD1','LEOPOLDINA','Relé','LDAT 138kV ALP','5203','2026-01-06','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-07','Concluído',null),
  ('PAM2026-0146',146,'CTZ','LPD1','LEOPOLDINA','Relé','LDAT 138kV LPD2','5201','2026-01-06','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-07','Concluído',null),
  ('PAM2026-0147',147,'CTZ','LPD1','LEOPOLDINA','Relé','LDAT 69kV RCO','5204','2026-01-06','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-01-09','Concluído',null),
  ('PAM2026-0148',148,'CTZ','LPD1','LEOPOLDINA','Relé','TF 138/69KV','9701','2026-01-06','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-01-07','Concluído',null),
  ('PAM2026-0149',149,'CTZ','LPD1','LEOPOLDINA','Relé','TF 69/11,4KV','9702','2026-01-06','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-01-08','Concluído',null),
  ('PAM2026-0150',150,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL LPD1','9606','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-07','Concluído',null),
  ('PAM2026-0151',151,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL LPD2','9603','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-13','Concluído',null),
  ('PAM2026-0152',152,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL LPD3','9604','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-13','Concluído',null),
  ('PAM2026-0153',153,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL LPD6','9602','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-13','Concluído',null),
  ('PAM2026-0154',154,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL LPD7','9607','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-09','Concluído',null),
  ('PAM2026-0155',155,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL PVD','9605','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-09','Concluído',null),
  ('PAM2026-0156',156,'CTZ','LPD1','LEOPOLDINA','Religador de Subestação','RL VAL','9601','2026-01-06','AT037 - Manutenção preventiva - religador de subestação',1,'2026-01-09','Concluído',null),
  ('PAM2026-0157',157,'CTZ','LPD1','LEOPOLDINA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-01-06','AT038 - Manutenção preventiva - retificador',1,'2026-01-08','Concluído',null),
  ('PAM2026-0158',158,'CTZ','LRJ','LARANJAL','Painéis de Automação','C50','Concentrador','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0159',159,'CTZ','LRJ','LARANJAL','Regulador de Subestação','R.U.A-01','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0160',160,'CTZ','LRJ','LARANJAL','Relé','TF 69/11,4KV','9701','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0161',161,'CTZ','LRJ','LARANJAL','Religador de Subestação','RL LRJ','9602','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0162',162,'CTZ','LRJ','LARANJAL','Religador de Subestação','RL PAL','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0163',163,'CTZ','LRJ','LARANJAL','Religador de Subestação','RL RBJ','9604','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0164',164,'CTZ','LRJ','LARANJAL','Religador de Subestação','RL SJS','9605','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-27','Concluído',null),
  ('PAM2026-0165',165,'CTZ','LRJ','LARANJAL','Religador de Subestação','RL SNC','9603','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0166',166,'CTZ','LRJ','LARANJAL','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-06-01','AT038 - Manutenção preventiva - retificador',1,'2026-05-28','Concluído',null),
  ('PAM2026-0167',167,'MAU','MAM','MANHUMIRIM','Painéis de Automação','C50','Concentrador','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0168',168,'MAU','MAM','MANHUMIRIM','Regulador de Subestação','RT3-1','Relé','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0169',169,'MAU','MAM','MANHUMIRIM','Relé','BC','5203','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0170',170,'MAU','MAM','MANHUMIRIM','Relé','TF 69/11,4KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0171',171,'MAU','MAM','MANHUMIRIM','Religador de Subestação','RL AJQ','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0172',172,'MAU','MAM','MANHUMIRIM','Religador de Subestação','RL LSA','9601','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0173',173,'MAU','MAM','MANHUMIRIM','Religador de Subestação','RL MAM1','9603','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0174',174,'MAU','MAM','MANHUMIRIM','Religador de Subestação','RL MAM2','9604','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0175',175,'MAU','MAM','MANHUMIRIM','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0176',176,'MAU','MAU1','MANHUAÇU','Painéis de Automação','C50','Concentrador','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0177',177,'MAU','MAU1','MANHUAÇU','Regulador de Subestação','RT3-1','Relé','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0178',178,'MAU','MAU1','MANHUAÇU','Relé','BC','5208','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0179',179,'MAU','MAU1','MANHUAÇU','Relé','LDAT CEMIG','5205','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-07','Concluído','2026-07-07'),
  ('PAM2026-0180',180,'MAU','MAU1','MANHUAÇU','Relé','LDAT MAM','5207','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0181',181,'MAU','MAU1','MANHUAÇU','Relé','LDAT MAO','5201','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10')
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0182',182,'MAU','MAU1','MANHUAÇU','Relé','LDAT UBB','5206','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0183',183,'MAU','MAU1','MANHUAÇU','Relé','TF138/69KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0184',184,'MAU','MAU1','MANHUAÇU','Relé','TF69/11,4KV','9702','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-07','Concluído','2026-07-07'),
  ('PAM2026-0185',185,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU1','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0186',186,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU2','9603','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0187',187,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU3','9604','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0188',188,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU4','9606','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0189',189,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU5','9601','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0190',190,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAU6','9605','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0191',191,'MAU','MAU1','MANHUAÇU','Religador de Subestação','RL MAS','5204','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0192',192,'MAU','MAU1','MANHUAÇU','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0193',193,'MAU','MAU2','MANHUAÇU','Painéis de Automação','ELIPSE','Painel','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0194',194,'MAU','MAU2','MANHUAÇU','Regulador de Subestação','SEL2414','Relé','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0195',195,'MAU','MAU2','MANHUAÇU','Relé','BC','5208','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0196',196,'MAU','MAU2','MANHUAÇU','Relé','LDAT MAU1','5202','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0197',197,'MAU','MAU2','MANHUAÇU','Relé','LDAT PAO2','5201','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0198',198,'MAU','MAU2','MANHUAÇU','Relé','TF 138/11,4KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0199',199,'MAU','MAU2','MANHUAÇU','Religador de Subestação','RL MAU10','9603','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0200',200,'MAU','MAU2','MANHUAÇU','Religador de Subestação','RL MAU8','9601','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0201',201,'MAU','MAU2','MANHUAÇU','Religador de Subestação','RL MAU9','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0202',202,'MAU','MAU2','MANHUAÇU','Religador de Subestação','RL TRANSFERÊNCIA','9604','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0203',203,'MAU','MAU2','MANHUAÇU','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0204',204,'CTZ','MCS','MERÇÊS','Painéis de Automação','C50','Concentradora de dados','2026-07-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0205',205,'CTZ','MCS','MERÇÊS','Regulador de Subestação','R.U.A-01','Relé','2026-07-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0206',206,'CTZ','MCS','MERÇÊS','Relé','TF 22/11,4KV','9703','2026-07-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0207',207,'CTZ','MCS','MERÇÊS','Religador de Subestação','RL MCS1','9602','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0208',208,'CTZ','MCS','MERÇÊS','Religador de Subestação','RL MCS2','9601','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0209',209,'CTZ','MCS','MERÇÊS','Religador de Subestação','RL MCS3','9603','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0210',210,'CTZ','MCS','MERÇÊS','Serviços Essenciais','SERVIÇOS ESSENCIAIS','SERVIÇOS ESSENCIAIS','2026-07-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-27','Em Execução',null),
  ('PAM2026-0211',211,'MRE','MRE1','MURIAÉ','Painéis de Automação','RTAC','Rtac','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-05-21','Concluído',null),
  ('PAM2026-0212',212,'MRE','MRE1','MURIAÉ','Regulador de Subestação','RT3-1','Relé','2026-03-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-05-21','Concluído',null),
  ('PAM2026-0213',213,'MRE','MRE1','MURIAÉ','Relé','BC1','5207','2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0214',214,'MRE','MRE1','MURIAÉ','Relé','BC2','5208','2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0215',215,'MRE','MRE1','MURIAÉ','Relé','BC3',null,'2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0216',216,'MRE','MRE1','MURIAÉ','Relé','BC4',null,'2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0217',217,'MRE','MRE1','MURIAÉ','Relé','LDAT CTZ2','5204','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0218',218,'MRE','MRE1','MURIAÉ','Relé','LDAT MRE2','5203','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0219',219,'MRE','MRE1','MURIAÉ','Relé','TF 22/11,4KV','9702','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0220',220,'MRE','MRE1','MURIAÉ','Relé','TF 69/11,4KV','9701','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-05-21','Concluído',null),
  ('PAM2026-0221',221,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL CAA','9602','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-19','Concluído',null),
  ('PAM2026-0222',222,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL MRE1','9604','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-19','Concluído',null),
  ('PAM2026-0223',223,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL MRE2','9605','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-19','Concluído',null),
  ('PAM2026-0224',224,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL MRE3','9606','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-19','Concluído',null),
  ('PAM2026-0225',225,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL MRE4','9603','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-20','Concluído',null),
  ('PAM2026-0226',226,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL PMV','9607','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-20','Concluído',null),
  ('PAM2026-0227',227,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL SAF','9601','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-20','Concluído',null),
  ('PAM2026-0228',228,'MRE','MRE1','MURIAÉ','Religador de Subestação','RL UCD','5206','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-20','Concluído',null),
  ('PAM2026-0229',229,'MRE','MRE1','MURIAÉ','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-03-01','AT038 - Manutenção preventiva - retificador',1,'2026-05-21','Concluído',null),
  ('PAM2026-0230',230,'MRE','MRE2','MURIAÉ','Painéis de Automação','C50','Concentrador','2026-03-02','AT027 - Manutenção preventiva - painel de automação',1,'2026-03-02','Concluído',null),
  ('PAM2026-0231',231,'MRE','MRE2','MURIAÉ','Regulador de Subestação','MK20','Regulador de Tensão','2026-03-02','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-03-02','Concluído',null),
  ('PAM2026-0232',232,'MRE','MRE2','MURIAÉ','Relé','BC1','5207','2026-03-03','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-04-29'),
  ('PAM2026-0233',233,'MRE','MRE2','MURIAÉ','Relé','BC2','5208','2026-03-03','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-04-29'),
  ('PAM2026-0234',234,'MRE','MRE2','MURIAÉ','Relé','BC3',null,'2026-03-03','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-04-29'),
  ('PAM2026-0235',235,'MRE','MRE2','MURIAÉ','Relé','LDAT EUG','5204','2026-03-03','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-04-28'),
  ('PAM2026-0236',236,'MRE','MRE2','MURIAÉ','Relé','LDAT MRE1','5205','2026-03-03','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-04-28'),
  ('PAM2026-0237',237,'MRE','MRE2','MURIAÉ','Relé','LDAT UBR','5201','2026-03-03','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-04-28'),
  ('PAM2026-0238',238,'MRE','MRE2','MURIAÉ','Relé','LDAT UOB','5203','2026-03-04','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-04-28'),
  ('PAM2026-0239',239,'MRE','MRE2','MURIAÉ','Relé','LDAT VOT','5210','2026-03-04','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-04-28'),
  ('PAM2026-0240',240,'MRE','MRE2','MURIAÉ','Relé','TF 138/69KV','9701','2026-03-04','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-04-27'),
  ('PAM2026-0241',241,'MRE','MRE2','MURIAÉ','Relé','TF 69/11,4KV','9702','2026-03-04','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-04-27'),
  ('PAM2026-0242',242,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL FAM','9607','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0243',243,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL IVAIR ou PTM','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0244',244,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL MRE5','9605','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0245',245,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL MRE6','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0246',246,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL MRE7','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0247',247,'MRE','MRE2','MURIAÉ','Religador de Subestação','RL MRE8','9606','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-04-01','Concluído',null),
  ('PAM2026-0248',248,'MRE','MRE2','MURIAÉ','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-03-02','AT038 - Manutenção preventiva - retificador',1,'2026-03-02','Concluído',null),
  ('PAM2026-0249',249,'CTZ','MRI','MIRAÍ','Painéis de Automação','C50','Concentrador','2026-07-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0250',250,'CTZ','MRI','MIRAÍ','Regulador de Subestação','R.U.A-01','Relé','2026-07-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0251',251,'CTZ','MRI','MIRAÍ','Relé','BC1','Relé','2026-07-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0252',252,'CTZ','MRI','MIRAÍ','Relé','TF69/22KV','9701','2026-07-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0253',253,'CTZ','MRI','MIRAÍ','Religador de Subestação','RL MRI1','9601','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0254',254,'CTZ','MRI','MIRAÍ','Religador de Subestação','RL MRI2','9602','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0255',255,'CTZ','MRI','MIRAÍ','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-07-01','AT038 - Manutenção preventiva - retificador',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0256',256,'MRE','MRU','MIRADOURO','Painéis de Automação','RTAC','Rtac','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-12','Programado',null),
  ('PAM2026-0257',257,'MRE','MRU','MIRADOURO','Regulador de Subestação','2414','Relé','2026-03-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-08-12','Programado',null),
  ('PAM2026-0258',258,'MRE','MRU','MIRADOURO','Relé','BC','5203','2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-08-12','Programado',null),
  ('PAM2026-0259',259,'MRE','MRU','MIRADOURO','Relé','TF 69/11,4KV','Relé','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-08-12','Programado',null),
  ('PAM2026-0260',260,'MRE','MRU','MIRADOURO','Religador de Subestação','RL MRU1','9601','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-12','Programado',null),
  ('PAM2026-0261',261,'MRE','MRU','MIRADOURO','Religador de Subestação','RL MRU2','9602','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0262',262,'MRE','MRU','MIRADOURO','Religador de Subestação','RL MRU3','9603','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0263',263,'MRE','MRU','MIRADOURO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-03-01','AT038 - Manutenção preventiva - retificador',1,'2026-08-12','Programado',null),
  ('PAM2026-0264',264,'CTZ','NUM','LEOPOLDINA','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0265',265,'CTZ','NUM','LEOPOLDINA','Regulador de Subestação','2414','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0266',266,'CTZ','NUM','LEOPOLDINA','Relé','LDAT LPD2-C2','5204','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0267',267,'CTZ','NUM','LEOPOLDINA','Relé','LDAT CTZ1','5205','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-03','Concluído','2026-07-03'),
  ('PAM2026-0268',268,'CTZ','NUM','LEOPOLDINA','Relé','LDAT LPD2-C1','5203','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0269',269,'CTZ','NUM','LEOPOLDINA','Relé','LDAT ASD/RDR/UBA1','5201','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-03','Concluído','2026-07-03'),
  ('PAM2026-0270',270,'CTZ','NUM','LEOPOLDINA','Relé','LDAT SJN','5206','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0271',271,'CTZ','NUM','LEOPOLDINA','Relé','LDAT UIB3','5202','2026-09-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-10','Concluído','2026-07-10')
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0272',272,'CTZ','NUM','LEOPOLDINA','Relé','TF 138/69KV','9701','2026-09-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0273',273,'CTZ','NUM','LEOPOLDINA','Relé','TF 22/11,4KV','9703','2026-09-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-01','Concluído','2026-07-01'),
  ('PAM2026-0274',274,'CTZ','NUM','LEOPOLDINA','Relé','TF 69/22KV','9701','2026-09-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-01','Concluído','2026-07-01'),
  ('PAM2026-0275',275,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL ASD','5203','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0276',276,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL CTZ','5208','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0277',277,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL ITM 11,4','5212','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-07','Concluído','2026-07-07'),
  ('PAM2026-0278',278,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL ITM 22','5209','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0279',279,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL SJN','5204','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0280',280,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL TBS','5201','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-02','Concluído','2026-07-02'),
  ('PAM2026-0281',281,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL UM','5202','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0282',282,'CTZ','NUM','LEOPOLDINA','Religador de Subestação','RL VGL','5206','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0283',283,'MAU','PAO1','PADRE FIALHO','Painéis de Automação','ELIPSE','Painel','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-24','Concluído','2026-07-23'),
  ('PAM2026-0284',284,'MAU','PAO1','PADRE FIALHO','Regulador de Subestação','REGULADOR DE TENSÃO','Regulador de Tensão','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0285',285,'MAU','PAO1','PADRE FIALHO','Relé','BC','5209','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-22','Concluído','2026-07-22'),
  ('PAM2026-0286',286,'MAU','PAO1','PADRE FIALHO','Relé','LDAT MAO','5203','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0287',287,'MAU','PAO1','PADRE FIALHO','Relé','LDAT PAO2','5201','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0288',288,'MAU','PAO1','PADRE FIALHO','Relé','LDAT SMA','5202','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0289',289,'MAU','PAO1','PADRE FIALHO','Relé','LT MC','5204','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0290',290,'MAU','PAO1','PADRE FIALHO','Relé','TF 138/11,4KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-23','Concluído','2026-07-23'),
  ('PAM2026-0291',291,'MAU','PAO1','PADRE FIALHO','Religador de Subestação','RL SAS','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-23','Concluído','2026-07-22'),
  ('PAM2026-0292',292,'MAU','PAO1','PADRE FIALHO','Religador de Subestação','RL SEA','9601','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-23','Concluído','2026-07-22'),
  ('PAM2026-0293',293,'MAU','PAO1','PADRE FIALHO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0294',294,'MAU','PAO2','PADRE FIALHO','Painéis de Automação','RTAC','Rtac','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-24','Concluído','2026-07-24'),
  ('PAM2026-0295',295,'MAU','PAO2','PADRE FIALHO','Relé','LDAT MAU2','Relé','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-24','Concluído','2026-07-24'),
  ('PAM2026-0296',296,'MAU','PAO2','PADRE FIALHO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-24','Concluído','2026-07-24'),
  ('PAM2026-0297',297,'CTZ','PRT1','PIRAPETINGA','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-03','Concluído','2026-07-22'),
  ('PAM2026-0298',298,'CTZ','PRT1','PIRAPETINGA','Regulador de Subestação','RUA','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-22','Concluído','2026-07-22'),
  ('PAM2026-0299',299,'CTZ','PRT1','PIRAPETINGA','Relé','BC','5204','2026-09-01','AT028 - Manutenção preventiva - proteção banco capacitor',1,'2026-07-22','Concluído','2026-07-22'),
  ('PAM2026-0300',300,'CTZ','PRT1','PIRAPETINGA','Relé','LDAT INPA','5202','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-07-22','Concluído','2026-07-23'),
  ('PAM2026-0301',301,'CTZ','PRT1','PIRAPETINGA','Relé','TF69/22KV','9701','2026-09-01','AT034 - Manutenção preventiva - proteção transformador',1,'2026-07-23','Concluído','2026-07-23'),
  ('PAM2026-0302',302,'CTZ','PRT1','PIRAPETINGA','Religador de Subestação','RL CID1','9601','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-23','Concluído','2026-07-23'),
  ('PAM2026-0303',303,'CTZ','PRT1','PIRAPETINGA','Religador de Subestação','RL CID2','9602','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-23','Concluído','2026-07-23'),
  ('PAM2026-0304',304,'CTZ','PRT1','PIRAPETINGA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-22','Concluído','2026-07-22'),
  ('PAM2026-0305',305,'CTZ','PRT2','PIRAPETINGA','Painéis de Automação','RTAC','Rtac','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-24','Concluído','2026-07-29'),
  ('PAM2026-0306',306,'CTZ','PRT2','PIRAPETINGA','Relé','LDAT PRT1','Relé','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-07-24','Concluído','2026-07-29'),
  ('PAM2026-0307',307,'CTZ','PRT2','PIRAPETINGA','Relé','LDAT UBR2','Relé','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-07-24','Concluído','2026-07-29'),
  ('PAM2026-0308',308,'CTZ','PRT2','PIRAPETINGA','Relé','TF 138/69KV','Relé','2026-09-01','AT034 - Manutenção preventiva - proteção transformador',1,'2026-07-24','Concluído','2026-07-29'),
  ('PAM2026-0309',309,'CTZ','PRT2','PIRAPETINGA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-24','Concluído','2026-07-29'),
  ('PAM2026-0310',310,'CTZ','RCO','RECREIO','Painéis de Automação','C50','Concentrador','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0311',311,'CTZ','RCO','RECREIO','Regulador de Subestação','R.U.A-01','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0312',312,'CTZ','RCO','RECREIO','Relé','BC','5203','2026-06-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0313',313,'CTZ','RCO','RECREIO','Relé','LDAT PRT','5202','2026-06-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0314',314,'CTZ','RCO','RECREIO','Relé','TF69/11,4KV','9701','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0315',315,'CTZ','RCO','RECREIO','Religador de Subestação','RL ABI','9604','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0316',316,'CTZ','RCO','RECREIO','Religador de Subestação','RL CIN','9603','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0317',317,'CTZ','RCO','RECREIO','Religador de Subestação','RL RCO','9602','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0318',318,'CTZ','RCO','RECREIO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-06-01','AT038 - Manutenção preventiva - retificador',1,null,'Concluído','2026-06-09'),
  ('PAM2026-0319',319,'UBA','RDR','RODEIRO','Painéis de Automação','C50','Concentrador','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-05-29','Concluído',null),
  ('PAM2026-0320',320,'UBA','RDR','RODEIRO','Regulador de Subestação','SEL2414','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-05-29','Concluído',null),
  ('PAM2026-0321',321,'UBA','RDR','RODEIRO','Relé','BC','5203','2026-06-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-05-29','Concluído',null),
  ('PAM2026-0322',322,'UBA','RDR','RODEIRO','Relé','TF 69/11,4KV','9701','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-05-29','Concluído',null),
  ('PAM2026-0323',323,'UBA','RDR','RODEIRO','Religador de Subestação','RL DTU','9603','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0324',324,'UBA','RDR','RODEIRO','Religador de Subestação','RL RDR2','9604','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0325',325,'UBA','RDR','RODEIRO','Religador de Subestação','RL GDV','9602','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0326',326,'UBA','RDR','RODEIRO','Religador de Subestação','RL RDR','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-05-28','Concluído',null),
  ('PAM2026-0327',327,'UBA','RDR','RODEIRO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-06-01','AT038 - Manutenção preventiva - retificador',1,'2026-05-29','Concluído',null),
  ('PAM2026-0328',328,'MAU','REA','REALEZA','Painéis de Automação','C50','Concentrador','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0329',329,'MAU','REA','REALEZA','Regulador de Subestação','SEL2414','Relé','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0330',330,'MAU','REA','REALEZA','Relé','BC','5202','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0331',331,'MAU','REA','REALEZA','Relé','TF 69/11,4KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0332',332,'MAU','REA','REALEZA','Religador de Subestação','RL CPA','9603','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0333',333,'MAU','REA','REALEZA','Religador de Subestação','RL DOC','9604','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0334',334,'MAU','REA','REALEZA','Religador de Subestação','RL REA1','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0335',335,'MAU','REA','REALEZA','Religador de Subestação','RL SAC','9605','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0336',336,'MAU','REA','REALEZA','Religador de Subestação','RL SJM','9601','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0337',337,'MAU','REA','REALEZA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0338',338,'CTZ','RIN','RIO NOVO','Painéis de Automação','C50','Concentrador','2026-07-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-07-27'),
  ('PAM2026-0339',339,'CTZ','RIN','RIO NOVO','Regulador de Subestação','R.U.A-01','Relé','2026-07-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-27','Concluído','2026-07-27'),
  ('PAM2026-0340',340,'CTZ','RIN','RIO NOVO','Relé','BC','5202','2026-07-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-28','Concluído','2026-07-28'),
  ('PAM2026-0341',341,'CTZ','RIN','RIO NOVO','Relé','TF 69/11,4KV','9701','2026-07-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-27','Concluído','2026-07-27'),
  ('PAM2026-0342',342,'CTZ','RIN','RIO NOVO','Religador de Subestação','RL GNI','5203','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-28','Concluído','2026-07-28'),
  ('PAM2026-0343',343,'CTZ','RIN','RIO NOVO','Religador de Subestação','RL RIN1','9602','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-27','Concluído','2026-07-27'),
  ('PAM2026-0344',344,'CTZ','RIN','RIO NOVO','Religador de Subestação','RL RIN2','9603','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-28','Concluído','2026-07-28'),
  ('PAM2026-0345',345,'CTZ','RIN','RIO NOVO','Religador de Subestação','RL TF22/11,4KV','9601','2026-07-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-28','Concluído','2026-07-28'),
  ('PAM2026-0346',346,'CTZ','RIN','RIO NOVO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-07-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-27','Concluído','2026-07-27'),
  ('PAM2026-0347',347,'MAU','SAM','SANTANA DO MANHUAÇU','Painéis de Automação','CONCENTRADORA DE DADOS','Concentrador','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0348',348,'MAU','SAM','SANTANA DO MANHUAÇU','Regulador de Subestação','RT3-1','Relé','2026-05-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0349',349,'MAU','SAM','SANTANA DO MANHUAÇU','Relé','BC','5204','2026-05-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0350',350,'MAU','SAM','SANTANA DO MANHUAÇU','Relé','TF 11,4/22KV','9703','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0351',351,'MAU','SAM','SANTANA DO MANHUAÇU','Relé','TF 69/11,4KV','9701','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0352',352,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL CBS','9608','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0353',353,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL RUA','9604','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0354',354,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL PIN','9609','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0355',355,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL RURAL','9605','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0356',356,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL SAM1','9603','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0357',357,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL SIA','9602','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0358',358,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL SSRP','9607','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0359',359,'MAU','SAM','SANTANA DO MANHUAÇU','Religador de Subestação','RL USC','9606','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0360',360,'MAU','SAM','SANTANA DO MANHUAÇU','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-05-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0361',361,'CTZ','SEDE','CATAGUASES','Disjuntor de Subestação','ABB','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-03-30','Concluído',null)
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0362',362,'CTZ','SEDE','CATAGUASES','Disjuntor de Subestação','ABB','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-03-30','Concluído',null),
  ('PAM2026-0363',363,'CTZ','SEDE','CATAGUASES','Disjuntor de Subestação','ABB','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-03-30','Concluído',null),
  ('PAM2026-0364',364,'CTZ','SEDE','CATAGUASES','Disjuntor de Subestação','ABB','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-03-30','Concluído',null),
  ('PAM2026-0365',365,'CTZ','SEDE','CATAGUASES','Disjuntor de Subestação','ABB','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-03-30','Concluído',null),
  ('PAM2026-0366',366,'CTZ','SEDE','CATAGUASES','Painéis de Automação','C50','Concentrador','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0367',367,'CTZ','SEDE','CATAGUASES','Painéis de Automação','RTAC','Rtac','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-03-30','Concluído',null),
  ('PAM2026-0368',368,'CTZ','SER','SERENO','Religador de Subestação','RL SER','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-23'),
  ('PAM2026-0369',369,'CTZ','SER','SERENO','Religador de Subestação','TF 22/11,4KV','5201','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-23'),
  ('PAM2026-0370',370,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0371',371,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Regulador de Subestação','RT3-1','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0372',372,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Relé','BC','5203','2026-09-01','AT028 - Manutenção preventiva - proteção banco capacitor',1,null,'Não Programado',null),
  ('PAM2026-0373',373,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Relé','LDAT RIN','5202','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,null,'Não Programado',null),
  ('PAM2026-0374',374,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Relé','TF 69/11,4KV','9701','2026-09-01','AT034 - Manutenção preventiva - proteção transformador',1,null,'Não Programado',null),
  ('PAM2026-0375',375,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL DCB','9604','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0376',376,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL RCM','9606','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0377',377,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL RGR','9605','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0378',378,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL SJN1','9601','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0379',379,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL SJN2','9602','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0380',380,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Religador de Subestação','RL SJN3','9603','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0381',381,'CTZ','SJN','SÃO JOÃO NEPOMUCENO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0382',382,'UBA','SMA','SÃO MIGUEL DO ANTA','Painéis de Automação','C50','Concentrador','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0383',383,'UBA','SMA','SÃO MIGUEL DO ANTA','Regulador de Subestação','2414','Relé','2026-09-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0384',384,'UBA','SMA','SÃO MIGUEL DO ANTA','Relé','BC','5204','2026-09-01','AT028 - Manutenção preventiva - proteção banco capacitor',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0385',385,'UBA','SMA','SÃO MIGUEL DO ANTA','Relé','LDAT PAO','5203','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0386',386,'UBA','SMA','SÃO MIGUEL DO ANTA','Relé','LDAT VRB2','5202','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0387',387,'UBA','SMA','SÃO MIGUEL DO ANTA','Relé','TF 138/11,4KV','9701','2026-09-01','AT034 - Manutenção preventiva - proteção transformador',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0388',388,'UBA','SMA','SÃO MIGUEL DO ANTA','Religador de Subestação','RL CNA','9603','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-12'),
  ('PAM2026-0389',389,'UBA','SMA','SÃO MIGUEL DO ANTA','Religador de Subestação','RL CSC','9602','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-12'),
  ('PAM2026-0390',390,'UBA','SMA','SÃO MIGUEL DO ANTA','Religador de Subestação','RL PEA','9604','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-12'),
  ('PAM2026-0391',391,'UBA','SMA','SÃO MIGUEL DO ANTA','Religador de Subestação','RL SMA1','9601','2026-09-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-12'),
  ('PAM2026-0392',392,'UBA','SMA','SÃO MIGUEL DO ANTA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,null,'Concluído','2026-06-11'),
  ('PAM2026-0393',393,'MAU','STM','SANTA MARGARIDA','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0394',394,'MAU','STM','SANTA MARGARIDA','Regulador de Subestação','SEL 2414','Relé','2026-08-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0395',395,'MAU','STM','SANTA MARGARIDA','Relé','TF 69/11,4KV','9701','2026-08-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0396',396,'MAU','STM','SANTA MARGARIDA','Religador de Subestação','RL SDO','9601','2026-08-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0397',397,'MAU','STM','SANTA MARGARIDA','Religador de Subestação','RL SFX','9603','2026-08-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0398',398,'MAU','STM','SANTA MARGARIDA','Religador de Subestação','RL SJM2','9604','2026-08-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0399',399,'MAU','STM','SANTA MARGARIDA','Religador de Subestação','RL STM1','9602','2026-08-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0400',400,'MAU','STM','SANTA MARGARIDA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-08-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0401',401,'CTZ','SUM','SUMIDOURO','Painéis de Automação','C50','Concentrador','2026-02-27','AT027 - Manutenção preventiva - painel de automação',1,'2026-02-12','Concluído',null),
  ('PAM2026-0402',402,'CTZ','SUM','SUMIDOURO','Regulador de Subestação','RUA','Relé','2026-02-27','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-02-12','Concluído',null),
  ('PAM2026-0403',403,'CTZ','SUM','SUMIDOURO','Relé','TF 69/11,4KV','9701','2026-02-13','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-02-13','Concluído',null),
  ('PAM2026-0404',404,'CTZ','SUM','SUMIDOURO','Religador de Subestação','RL SUM1','9601','2026-02-13','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-13','Concluído',null),
  ('PAM2026-0405',405,'CTZ','SUM','SUMIDOURO','Religador de Subestação','RL SUM2','9602','2026-02-13','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-13','Concluído',null),
  ('PAM2026-0406',406,'CTZ','SUM','SUMIDOURO','Religador de Subestação','RL SUM3','9603','2026-02-13','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-13','Concluído',null),
  ('PAM2026-0407',407,'CTZ','SUM','SUMIDOURO','Religador de Subestação','RL SUM4','9604','2026-02-13','AT037 - Manutenção preventiva - religador de subestação',1,'2026-02-13','Concluído',null),
  ('PAM2026-0408',408,'CTZ','SUM','SUMIDOURO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-02-27','AT038 - Manutenção preventiva - retificador',1,'2026-02-12','Concluído',null),
  ('PAM2026-0409',409,'CTZ','TBS','TEBAS','Painéis de Automação','C50','Concentrador','2026-06-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-10','Concluído','2026-07-06'),
  ('PAM2026-0410',410,'CTZ','TBS','TEBAS','Regulador de Subestação','RUA','Relé','2026-06-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-10','Concluído','2026-07-06'),
  ('PAM2026-0411',411,'CTZ','TBS','TEBAS','Religador de Subestação','RL 11KV','5202','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-06','Concluído','2026-07-06'),
  ('PAM2026-0412',412,'CTZ','TBS','TEBAS','Religador de Subestação','RL 22KV','5201','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-06','Concluído','2026-07-06'),
  ('PAM2026-0413',413,'CTZ','TBS','TEBAS','Religador de Subestação','RL ARG','9601','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0414',414,'CTZ','TBS','TEBAS','Religador de Subestação','RL TBS','9602','2026-06-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0415',415,'CTZ','TBS','TEBAS','Religador de Subestação','TF22/11,4KV','Relé do 5201','2026-06-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-10','Concluído','2026-07-10'),
  ('PAM2026-0416',416,'UBA','TCT','TOCANTINS','Painéis de Automação','C50','Concentrador','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-29','Concluído','2026-07-29'),
  ('PAM2026-0417',417,'UBA','TCT','TOCANTINS','Regulador de Subestação','RT3','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-07-29','Concluído','2026-07-29'),
  ('PAM2026-0418',418,'UBA','TCT','TOCANTINS','Relé','BC','5202','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-29','Concluído','2026-07-29'),
  ('PAM2026-0419',419,'UBA','TCT','TOCANTINS','Relé','BC2','5204','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-29','Concluído','2026-07-31'),
  ('PAM2026-0420',420,'UBA','TCT','TOCANTINS','Relé','LDAT UTE2','5203','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-07-30','Concluído','2026-07-30'),
  ('PAM2026-0421',421,'UBA','TCT','TOCANTINS','Relé','TF 138/11,4KV','9701','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-07-30','Concluído','2026-07-30'),
  ('PAM2026-0422',422,'UBA','TCT','TOCANTINS','Religador de Subestação','RL PRB','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-31','Concluído','2026-07-31'),
  ('PAM2026-0423',423,'UBA','TCT','TOCANTINS','Religador de Subestação','RL PRB2','9605','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-31','Concluído','2026-07-31'),
  ('PAM2026-0424',424,'UBA','TCT','TOCANTINS','Religador de Subestação','RL TCT1','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-29','Concluído','2026-07-29'),
  ('PAM2026-0425',425,'UBA','TCT','TOCANTINS','Religador de Subestação','RL TCT2','9601','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-30','Concluído','2026-07-30'),
  ('PAM2026-0426',426,'UBA','TCT','TOCANTINS','Religador de Subestação','RL TCT3','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-07-30','Concluído','2026-07-30'),
  ('PAM2026-0427',427,'UBA','TCT','TOCANTINS','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-04-01','AT038 - Manutenção preventiva - retificador',1,'2026-07-29','Concluído','2026-07-29'),
  ('PAM2026-0428',428,'UBA','UBA1','UBA','Painéis de Automação','C50','Concentrador','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0429',429,'UBA','UBA1','UBA','Regulador de Subestação','RT3-1','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0430',430,'UBA','UBA1','UBA','Relé','BC1','5205','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0431',431,'UBA','UBA1','UBA','Relé','BC2','5204','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0432',432,'UBA','UBA1','UBA','Relé','BC3','5206','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0433',433,'UBA','UBA1','UBA','Relé','LDAT RDR/ASD/NUM','5201','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0434',434,'UBA','UBA1','UBA','Relé','LDAT UBA2','5203','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0435',435,'UBA','UBA1','UBA','Relé','LDAT VRB2','5202','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-03'),
  ('PAM2026-0436',436,'UBA','UBA1','UBA','Relé','TF 69/11,4KV','9701','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0437',437,'UBA','UBA1','UBA','Religador de Subestação','RL TQO','9606','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0438',438,'UBA','UBA1','UBA','Religador de Subestação','RL UBA1','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-01'),
  ('PAM2026-0439',439,'UBA','UBA1','UBA','Religador de Subestação','RL UBA10','9605','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0440',440,'UBA','UBA1','UBA','Religador de Subestação','RL UBA13','9607','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0441',441,'UBA','UBA1','UBA','Religador de Subestação','RL UBA2','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-01'),
  ('PAM2026-0442',442,'UBA','UBA1','UBA','Religador de Subestação','RL UBA3','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0443',443,'UBA','UBA1','UBA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-04-01','AT038 - Manutenção preventiva - retificador',1,null,'Concluído','2026-06-02'),
  ('PAM2026-0444',444,'UBA','UBA3','UBA','Painéis de Automação','ELIPSE','Painel','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0445',445,'UBA','UBA3','UBA','Regulador de Subestação','SEL2414','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0446',446,'UBA','UBA3','UBA','Relé','BC','5208','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0447',447,'UBA','UBA3','UBA','Relé','BC','Relé','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0448',448,'UBA','UBA3','UBA','Relé','BC','Relé','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Concluído','2026-06-10'),
  ('PAM2026-0449',449,'UBA','UBA3','UBA','Relé','LDAT UBA2','5202','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0450',450,'UBA','UBA3','UBA','Relé','LDAT UIB3','5201','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0451',451,'UBA','UBA3','UBA','Relé','TF 138/11,4KV','9701','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-08-04','Em Execução',null)
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

insert into public.maintenance_plan_items (id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
select
  v.id,
  v.source_row,
  v.region,
  v.substation_ref,
  v.locality,
  v.item_group,
  v.plant_structure,
  v.sgd_key,
  nullif(v.planned_for, '')::date,
  v.service_description,
  v.quantity,
  nullif(v.source_execution_date, '')::date,
  v.source_status,
  nullif(v.completion_date, '')::date
from (values
  ('PAM2026-0452',452,'UBA','UBA3','UBA','Religador de Subestação','RL UBA14','9601','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0453',453,'UBA','UBA3','UBA','Religador de Subestação','RL UBA15','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-05','Em Execução',null),
  ('PAM2026-0454',454,'UBA','UBA3','UBA','Religador de Subestação','RL UBA16','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-05','Em Execução',null),
  ('PAM2026-0455',455,'UBA','UBA3','UBA','Religador de Subestação','RL UBA17','9604','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-05','Em Execução',null),
  ('PAM2026-0456',456,'UBA','UBA3','UBA','Religador de Subestação','TRANSFERÊNCIA','9605','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-05','Em Execução',null),
  ('PAM2026-0457',457,'UBA','UBA3','UBA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-04-01','AT038 - Manutenção preventiva - retificador',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0458',458,'MAU','UBB','MANHUAÇU','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0459',459,'MAU','UBB','MANHUAÇU','Relé','LDAT MAU','5202','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0460',460,'MAU','UBB','MANHUAÇU','Relé','LDAT SAM/UNB','5201','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0461',461,'CTZ','UBR','RECREIO','Painéis de Automação','RTAC','Rtac','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0462',462,'CTZ','UBR','RECREIO','Relé','LDAT CTZ2','5201','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0463',463,'CTZ','UBR','RECREIO','Relé','LDAT MRE2','5203','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0464',464,'CTZ','UBR','RECREIO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0465',465,'CTZ','UBR2','ANGATURAMA','Painéis de Automação','RTAC','Rtac','2026-09-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0466',466,'CTZ','UBR2','ANGATURAMA','Relé','LDAT MRE2','5202','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0467',467,'CTZ','UBR2','ANGATURAMA','Relé','LDAT PRT2','5205','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0468',468,'CTZ','UBR2','ANGATURAMA','Relé','LDAT UBR1','5201','2026-09-01','AT032 - Manutenção preventiva - proteção LDAT',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0469',469,'CTZ','UBR2','ANGATURAMA','Relé','DJ TRANSFERENCIA','5203','2026-09-01','AT034 - Manutenção preventiva - DJ de Transferência',1,'2026-08-06','Em Execução',null),
  ('PAM2026-0470',470,'CTZ','UBR2','ANGATURAMA','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-09-01','AT038 - Manutenção preventiva - retificador',1,'2026-08-04','Em Execução',null),
  ('PAM2026-0471',471,'MRE','UCD','MURIAÉ','Relé','LDAT MRE1','5206','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-14','Programado',null),
  ('PAM2026-0472',472,'MRE','UCD','MURIAÉ','Relé','TF 22/11,4KV','9702','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-08-14','Programado',null),
  ('PAM2026-0473',473,'MRE','UCD','MURIAÉ','Religador de Subestação','RL ITR','9602','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-14','Programado',null),
  ('PAM2026-0474',474,'MRE','UCD','MURIAÉ','Religador de Subestação','RL ROL','9601','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-14','Programado',null),
  ('PAM2026-0475',475,'UBA','ERA','ERVÁLIA','Painéis de Automação','C50','Concentrador','2026-04-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0476',476,'UBA','ERA','ERVÁLIA','Regulador de Subestação','RUA','Relé','2026-04-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0477',477,'UBA','ERA','ERVÁLIA','Relé','BC','5206','2026-04-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0478',478,'UBA','ERA','ERVÁLIA','Relé','LDAT GCM','5203','2026-04-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0479',479,'UBA','ERA','ERVÁLIA','Relé','TF 69/11,4KV','9702','2026-04-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0480',480,'UBA','ERA','ERVÁLIA','Religador de Subestação','RL DSO','9601','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0481',481,'UBA','ERA','ERVÁLIA','Religador de Subestação','RL ERA','9602','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0482',482,'UBA','ERA','ERVÁLIA','Religador de Subestação','RL STR','9603','2026-04-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0483',483,'MRE','UGL','MURIAÉ','Painéis de Automação','RTAC','Rtac','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-13','Programado',null),
  ('PAM2026-0484',484,'MRE','UGL','MURIAÉ','Regulador de Subestação','RUA','Relé','2026-03-01','AT036 - Manutenção preventiva - regulador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0485',485,'MRE','UGL','MURIAÉ','Relé','LDAT MRU','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-13','Programado',null),
  ('PAM2026-0486',486,'MRE','UGL','MURIAÉ','Relé','LDAT UCE','Relé','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-13','Programado',null),
  ('PAM2026-0487',487,'MRE','UGL','MURIAÉ','Relé','TF 69/11,4KV','9702','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-08-13','Programado',null),
  ('PAM2026-0488',488,'MRE','UGL','MURIAÉ','Religador de Subestação','RL MRU','9601','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0489',489,'MRE','UGL','MURIAÉ','Religador de Subestação','RL SJG','9602','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0490',490,'CTZ','UGY','SANTOS DUMONT','Painéis de Automação','C50','Concentrador','2026-07-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0491',491,'CTZ','UGY','SANTOS DUMONT','Relé','LDAT UTE2','5209','2026-07-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0492',492,'CTZ','UGY','SANTOS DUMONT','Relé','LDAT UTJF','5207','2026-07-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0493',493,'CTZ','UIB1','GUARANI','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-07-13','Programado',null),
  ('PAM2026-0494',494,'CTZ','UIB1','GUARANI','Relé','LDAT UIB2','5206','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'A Reprogramar',null),
  ('PAM2026-0495',495,'CTZ','UIB2','GUARANI','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-08'),
  ('PAM2026-0496',496,'CTZ','UIB2','GUARANI','Relé','LDAT UIB1','5202','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-08'),
  ('PAM2026-0497',497,'CTZ','UIB2','GUARANI','Relé','LDAT UZT/UIB3','5201','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-08'),
  ('PAM2026-0498',498,'CTZ','UIB3','GUARANI','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Concluído','2026-06-22'),
  ('PAM2026-0499',499,'CTZ','UIB3','GUARANI','Relé','LDAT NUM','5203','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-22'),
  ('PAM2026-0500',500,'CTZ','UIB3','GUARANI','Relé','LDAT UBA3','5204','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-22'),
  ('PAM2026-0501',501,'CTZ','UIB3','GUARANI','Relé','LDAT UIB2','5205','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Concluído','2026-06-22'),
  ('PAM2026-0502',502,'MAU','UNB','IPANEMA','Painéis de Automação','C50','Concentrador','2026-05-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0503',503,'MAU','UNB','IPANEMA','Relé','LDAT UNB/SAM','5204','2026-05-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0504',504,'MAU','UNB','IPANEMA','Relé','TF 69/22KV','9705','2026-05-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0505',505,'MAU','UNB','IPANEMA','Religador de Subestação','RL ALI','5203','2026-05-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0506',506,'UBA','UOB','MURIAÉ','Painéis de Automação','C50','Concentrador','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0507',507,'UBA','UOB','MURIAÉ','Relé','LDAT MRE2','5203','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0508',508,'UBA','UOB','MURIAÉ','Relé','LDAT UGL','5202','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0509',509,'UBA','UOB','MURIAÉ','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-03-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0510',510,'UBA','UTC','RAUL SOARES','Painéis de Automação','C50','Concentrador','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0511',511,'UBA','UTC','RAUL SOARES','Relé','LDAT MAO','5202','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0512',512,'UBA','UTC','RAUL SOARES','Relé','LDAT UEB','5201','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0513',513,'UBA','UTC','RAUL SOARES','Relé','TF 138/9,6KV','Relé','2026-08-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0514',514,'UBA','UZT','PIRAÚBA','Painéis de Automação','PLC','Painel','2026-08-01','AT027 - Manutenção preventiva - painel de automação',1,'2026-08-12','Programado',null),
  ('PAM2026-0515',515,'UBA','UZT','PIRAÚBA','Relé','LDAT UIB2','5205','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-12','Programado',null),
  ('PAM2026-0516',516,'UBA','UZT','PIRAÚBA','Relé','LDAT UIB3','5206','2026-08-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,'2026-08-12','Programado',null),
  ('PAM2026-0517',517,'UBA','UZT','PIRAÚBA','Relé','TF 6,9/138KV','Relé','2026-08-01','AT035 - Manutenção preventiva - proteção transformador N2',1,'2026-08-12','Programado',null),
  ('PAM2026-0518',518,'MRE','VOT','MIRAÍ','Painéis de Automação','RTAC','Rtac','2026-07-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0519',519,'MRE','VOT','MIRAÍ','Relé','LDAT MRE2','Relé','2026-07-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0520',520,'MRE','VOT','MIRAÍ','Relé','LDAT VRB2','Relé','2026-07-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0521',521,'MRE','VOT','MIRAÍ','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-07-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0522',522,'UBA','VRB1','VISCONDE DO RIO BRANCO','Painéis de Automação','C50','Concentrador','2026-03-01','AT027 - Manutenção preventiva - painel de automação',1,null,'Não Programado',null),
  ('PAM2026-0523',523,'UBA','VRB1','VISCONDE DO RIO BRANCO','Regulador de Subestação','RT3-1','Relé','2026-03-01','AT036 - Manutenção preventiva - regulador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0524',524,'UBA','VRB1','VISCONDE DO RIO BRANCO','Relé','BC','5201','2026-03-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,null,'Não Programado',null),
  ('PAM2026-0525',525,'UBA','VRB1','VISCONDE DO RIO BRANCO','Relé','LDAT CBA','5202','2026-03-01','AT033 - Manutenção preventiva - proteção LDAT N2',1,null,'Não Programado',null),
  ('PAM2026-0526',526,'UBA','VRB1','VISCONDE DO RIO BRANCO','Relé','TF 69/11,4KV','9701','2026-03-01','AT035 - Manutenção preventiva - proteção transformador N2',1,null,'Não Programado',null),
  ('PAM2026-0527',527,'UBA','VRB1','VISCONDE DO RIO BRANCO','Religador de Subestação','RL SAG','9604','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0528',528,'UBA','VRB1','VISCONDE DO RIO BRANCO','Religador de Subestação','RL VRB3','9606','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0529',529,'UBA','VRB1','VISCONDE DO RIO BRANCO','Religador de Subestação','RL VRB4','9605','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0530',530,'UBA','VRB1','VISCONDE DO RIO BRANCO','Religador de Subestação','RL VRB1','9602','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0531',531,'UBA','VRB1','VISCONDE DO RIO BRANCO','Religador de Subestação','RL VRB2','9603','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,null,'Não Programado',null),
  ('PAM2026-0532',532,'UBA','VRB1','VISCONDE DO RIO BRANCO','Serviços Essenciais','SERVIÇOS ESSENCIAIS','Retificador','2026-03-01','AT038 - Manutenção preventiva - retificador',1,null,'Não Programado',null),
  ('PAM2026-0533',533,'CTZ','MCS','MERÇÊS','Banco de Capacitor','BC 01','5202','2026-07-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-22','Programado',null),
  ('PAM2026-0534',534,'MRE','MRU','Miradouro','Religador de Subestação','RL MRU-4','9604','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0535',535,'MRE','MRU','Miradouro','Religador de Subestação','RL MRU-5','9605','2026-03-01','AT037 - Manutenção preventiva - religador de subestação',1,'2026-08-13','Programado',null),
  ('PAM2026-0536',536,'CTZ','RIN','RIO NOVO','Relé','BC 02','5204','2026-07-01','AT029 - Manutenção preventiva - proteção banco capacitor N2',1,'2026-07-28','Concluído',null),
  ('PAM2026-0537',537,'UBA','TCT','TOCANTINS','Relé','LDAT UBA2','5205','2026-07-31','AT033 - Manutenção preventiva - proteção LDAT N2',null,'2026-07-31','Concluído',null)
) as v(id,source_row,region,substation_ref,locality,item_group,plant_structure,sgd_key,planned_for,service_description,quantity,source_execution_date,source_status,completion_date)
where not exists (
  select 1 from public.maintenance_plan_items m
   where m.id = v.id or m.source_row = v.source_row
);

-- ===== Verificações de sanidade =====
do $$
declare
  pam_count bigint;
begin
  select count(*) into pam_count from public.maintenance_plan_items;
  if pam_count = 0 then
    raise exception 'Hardening abortado: maintenance_plan_items continua vazio.';
  end if;
end $$;

commit;

-- Após executar, rode o arquivo SECURITY_AUDIT_V1.9.0.sql para conferir RLS/policies.
