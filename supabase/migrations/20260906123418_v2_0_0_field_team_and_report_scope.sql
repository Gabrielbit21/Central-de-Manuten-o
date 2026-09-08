-- Central de Manutenção SE — v2.0.0
-- Cadastro oficial dos técnicos de campo e separação de acesso entre
-- "Meus Relatórios" e histórico completo por ativo.

with technicians(display_name) as (
  values
    ('Fabricio Moura Ribeiro'),
    ('Felipe Joseph Nobrega'),
    ('Joel Felipe da Silva Gomes'),
    ('Jefferson Luis da Silva'),
    ('Logan Mendes Mota'),
    ('Luan Henrique Fernandes'),
    ('Lucas Trindade Pereira'),
    ('Murilo do Valle Teixeira'),
    ('Paulo Cesar de Oliveira'),
    ('Rafael Cardoso de Oliveira'),
    ('Richard Andrade'),
    ('Rodrigo Vieira Barreto'),
    ('Wendel de Souza Silva')
)
insert into public.personnel(display_name, active)
select t.display_name, true
from technicians t
where not exists (
  select 1
  from public.personnel p
  where lower(trim(p.display_name)) = lower(trim(t.display_name))
);

update public.personnel
set display_name = 'Felipe Joseph Nobrega',
    active = true,
    updated_at = now()
where lower(trim(display_name)) = lower('Felipe Joseph Nobrega');

update public.profiles
set display_name = 'Felipe Joseph Nobrega',
    updated_at = now()
where lower(trim(display_name)) = lower('Felipe Joseph Nobrega');

update public.profiles p
set personnel_id = pe.id,
    updated_at = now()
from public.personnel pe
where lower(trim(p.display_name)) = lower('Felipe Joseph Nobrega')
  and lower(trim(pe.display_name)) = lower('Felipe Joseph Nobrega')
  and p.personnel_id is distinct from pe.id;

drop policy if exists central_reports_select_active on public.maintenance_reports;
drop policy if exists central_reports_select_scope on public.maintenance_reports;
create policy central_reports_select_scope
on public.maintenance_reports
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or author_id = (select auth.uid())
    or exists (
      select 1
      from public.maintenance_report_participants rp
      join public.profiles p on p.personnel_id = rp.personnel_id
      where rp.report_id = maintenance_reports.id
        and p.id = (select auth.uid())
    )
  )
);

drop policy if exists central_report_participants_select_active on public.maintenance_report_participants;
drop policy if exists central_report_participants_select_scope on public.maintenance_report_participants;
create policy central_report_participants_select_scope
on public.maintenance_report_participants
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or personnel_id = (
      select p.personnel_id
      from public.profiles p
      where p.id = (select auth.uid())
      limit 1
    )
  )
);

drop policy if exists central_report_assets_select_active on public.maintenance_report_assets;
drop policy if exists central_report_assets_select_scope on public.maintenance_report_assets;
create policy central_report_assets_select_scope
on public.maintenance_report_assets
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or exists (
      select 1 from public.maintenance_reports r
      where r.id = maintenance_report_assets.report_id
    )
  )
);

drop policy if exists central_parts_select_active on public.maintenance_parts;
drop policy if exists central_parts_select_scope on public.maintenance_parts;
create policy central_parts_select_scope
on public.maintenance_parts
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or exists (
      select 1 from public.maintenance_reports r
      where r.id = maintenance_parts.report_id
    )
  )
);

drop policy if exists central_photos_select_active on public.maintenance_photos;
drop policy if exists central_photos_select_scope on public.maintenance_photos;
create policy central_photos_select_scope
on public.maintenance_photos
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or exists (
      select 1 from public.maintenance_reports r
      where r.id = maintenance_photos.report_id
    )
  )
);

drop policy if exists central_audit_select_active on public.audit_logs;
drop policy if exists central_audit_select_scope on public.audit_logs;
create policy central_audit_select_scope
on public.audit_logs
for select
to authenticated
using (
  public.central_is_active_user((select auth.uid()))
  and (
    public.central_is_admin((select auth.uid()))
    or exists (
      select 1 from public.maintenance_reports r
      where r.id = audit_logs.report_id
    )
  )
);

create or replace function public.get_asset_maintenance_history(p_asset_id text)
returns table (
  report_id uuid,
  report_number text,
  substation_id text,
  author_id uuid,
  author_name text,
  status text,
  outcome text,
  revision integer,
  payload jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  business_front text,
  participant_names text[],
  match_source text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.central_is_active_user(auth.uid()) then
    raise exception 'Acesso não autorizado ao histórico do ativo.';
  end if;

  if not exists (
    select 1 from public.assets a
    where a.id = p_asset_id and a.active
  ) then
    raise exception 'Ativo não encontrado ou inativo.';
  end if;

  return query
  with target as (
    select
      a.id,
      a.substation_id,
      regexp_replace(lower(coalesce(a.identification,'')), '[^a-z0-9]+', '', 'g') as ident_compact,
      regexp_replace(lower(coalesce(a.operating_number,'')), '[^a-z0-9]+', '', 'g') as oper_compact,
      regexp_replace(lower(coalesce(a.circuit,'')), '[^a-z0-9]+', '', 'g') as circuit_compact,
      regexp_replace(lower(coalesce(a.serial_number,'')), '[^a-z0-9]+', '', 'g') as serial_compact,
      concat_ws(' ', a.identification, a.operating_number, a.circuit, a.name) as asset_reference_text
    from public.assets a
    where a.id = p_asset_id
      and a.active
  ), candidates as (
    select
      r.*,
      t.id as target_asset_id,
      regexp_replace(
        lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')),
        '[^a-z0-9]+', '', 'g'
      ) as record_compact,
      lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')) as record_text,
      case
        when exists (
          select 1 from public.maintenance_report_assets mra
          where mra.report_id = r.id and mra.asset_id = t.id
        ) then 'asset_link'
        when coalesce(r.payload->'historical_matched_asset_ids','[]'::jsonb) @> to_jsonb(array[t.id]::text[]) then 'payload_asset_id'
        else 'historical_match'
      end as source_match
    from public.maintenance_reports r
    join target t on t.substation_id = r.substation_id
    where
      exists (
        select 1 from public.maintenance_report_assets mra
        where mra.report_id = r.id and mra.asset_id = t.id
      )
      or coalesce(r.payload->'historical_matched_asset_ids','[]'::jsonb) @> to_jsonb(array[t.id]::text[])
      or (length(t.ident_compact) >= 4 and regexp_replace(lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')), '[^a-z0-9]+', '', 'g') like '%' || t.ident_compact || '%')
      or (length(t.oper_compact) >= 4 and regexp_replace(lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')), '[^a-z0-9]+', '', 'g') like '%' || t.oper_compact || '%')
      or (length(t.circuit_compact) >= 4 and regexp_replace(lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')), '[^a-z0-9]+', '', 'g') like '%' || t.circuit_compact || '%')
      or (length(t.serial_compact) >= 5 and regexp_replace(lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')), '[^a-z0-9]+', '', 'g') like '%' || t.serial_compact || '%')
      or exists (
        select 1
        from regexp_matches(t.asset_reference_text, '[0-9]{4,}', 'g') as m(code)
        where lower(concat_ws(' ', r.payload->>'ativo', r.payload->>'serial')) ~ ('(^|[^0-9])' || m.code[1] || '([^0-9]|$)')
      )
  )
  select
    c.id,
    c.report_number,
    c.substation_id,
    c.author_id,
    coalesce(p.display_name, 'Usuário') as author_name,
    c.status,
    c.outcome,
    c.revision,
    c.payload,
    c.created_at,
    c.updated_at,
    c.business_front,
    coalesce((
      select array_agg(pe.display_name order by rp.position, pe.display_name)
      from public.maintenance_report_participants rp
      join public.personnel pe on pe.id = rp.personnel_id
      where rp.report_id = c.id
    ), array[]::text[]) as participant_names,
    c.source_match
  from candidates c
  left join public.profiles p on p.id = c.author_id
  order by c.created_at desc, c.id;
end;
$$;

revoke all on function public.get_asset_maintenance_history(text) from public, anon;
grant execute on function public.get_asset_maintenance_history(text) to authenticated, service_role;

comment on function public.get_asset_maintenance_history(text) is
'Canal controlado para histórico completo de um ativo. Permite consulta somente por ativo específico sem liberar leitura geral de maintenance_reports para perfis de campo.';
