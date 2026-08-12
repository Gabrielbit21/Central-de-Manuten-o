-- Central de Manutenção SE v1.5.0
-- Padronização da família de ativos para evolução futura da base.
-- Não habilita novos módulos na interface; somente prepara o contrato cadastral.

create table if not exists public.asset_families (
  code text primary key,
  label text not null,
  active boolean not null default false,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now()
);

insert into public.asset_families (code, label, active, sort_order)
values
  ('SUBESTACAO', 'Ativo de Subestação', true, 10),
  ('REPETIDORA', 'Repetidora', false, 20),
  ('RELIGADOR_DISTRIBUICAO', 'Religador de Distribuição', false, 30)
on conflict (code) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

alter table public.assets
  add column if not exists family_code text;

update public.assets
set family_code = 'SUBESTACAO'
where family_code is null or btrim(family_code) = '';

alter table public.assets
  alter column family_code set default 'SUBESTACAO';

alter table public.assets
  alter column family_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_family_code_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_family_code_fkey
      foreign key (family_code)
      references public.asset_families(code);
  end if;
end $$;

create index if not exists idx_assets_family_code
  on public.assets(family_code);

grant select on table public.asset_families to authenticated, service_role;
grant select on table public.asset_families to anon;

comment on table public.asset_families is
  'Famílias padronizadas de ativos. SUBESTACAO está ativa; REPETIDORA e RELIGADOR_DISTRIBUICAO ficam reservadas para módulos futuros.';
comment on column public.assets.family_code is
  'Família funcional do ativo usada pelo contrato padronizado de dados e exportações.';
