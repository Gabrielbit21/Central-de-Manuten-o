-- Central de Manutenção SE v1.9.0 — rollback da configuração de segurança
-- USE SOMENTE se a v1.9.0 precisar ser desfeita e depois republique a v1.8.2.
-- Não apaga relatórios, ativos, PAM ou fotos; restaura policies/grants/buckets salvos antes do hardening.

begin;

do $$
begin
  if to_regclass('public.central_security_backup_v190') is null
     or not exists (select 1 from public.central_security_backup_v190) then
    raise exception 'Rollback abortado: backup automático v1.9.0 não encontrado.';
  end if;
end $$;

-- Remove apenas as policies criadas pela v1.9.0.
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname, p.polname
      from pg_policy p
      join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace
     where p.polname like 'central_%'
       and ((n.nspname='public' and c.relname <> 'central_security_backup_v190')
            or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('drop policy if exists %I on %I.%I',r.polname,r.nspname,r.relname);
  end loop;
end $$;

-- Limpa os grants que a v1.9.0 alterou antes de restaurar o snapshot.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','substations','assets','asset_families',
    'maintenance_reports','maintenance_report_assets','maintenance_parts','maintenance_photos','audit_logs',
    'asset_operations','maintenance_plan_items','asset_import_batches','asset_audit_logs'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated',t);
    end if;
  end loop;
end $$;

-- Recria policies e grants exatamente como estavam antes da primeira execução da v1.9.0.
do $$
declare r record;
begin
  for r in select ddl from public.central_security_backup_v190 where kind='policy' order by id loop
    execute r.ddl;
  end loop;
  for r in select ddl from public.central_security_backup_v190 where kind='grant' order by id loop
    execute r.ddl;
  end loop;
end $$;

-- Restaura os privilégios EXECUTE efetivos das funções endurecidas.
do $$
declare r record;
begin
  for r in
    select object_key,value_json
      from public.central_security_backup_v190
     where kind='function_grant'
     order by id
  loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated, service_role',r.object_key);
      if coalesce((r.value_json->>'anon')::boolean,false) then
        execute format('grant execute on function %s to anon',r.object_key);
      end if;
      if coalesce((r.value_json->>'authenticated')::boolean,false) then
        execute format('grant execute on function %s to authenticated',r.object_key);
      end if;
      if coalesce((r.value_json->>'service_role')::boolean,false) then
        execute format('grant execute on function %s to service_role',r.object_key);
      end if;
    exception when undefined_function then
      null;
    end;
  end loop;
end $$;

-- Restaura a visibilidade anterior dos buckets.
do $$
declare r record;
begin
  for r in select value_json from public.central_security_backup_v190 where kind='bucket' loop
    update storage.buckets
       set public = (r.value_json->>'public')::boolean
     where id = r.value_json->>'id';
  end loop;
end $$;

drop view if exists public.profile_directory;
drop function if exists public.central_is_admin(uuid);
drop function if exists public.central_is_active_user(uuid);

commit;
