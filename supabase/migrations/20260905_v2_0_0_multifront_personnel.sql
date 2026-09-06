-- Central de Manutenção SE — v2.0.0
-- Fundação para múltiplas frentes de negócio e equipe executante normalizada.
-- Compatível com a v1.9.9: execute antes do merge da v2.0.0.

begin;

create table if not exists public.business_fronts (
  code text primary key,
  label text not null,
  active boolean not null default false,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now()
);

insert into public.business_fronts (code,label,active,sort_order)
values
  ('substation','Subestações',true,10),
  ('distribution','Distribuição',false,20),
  ('telecom','Telecom',false,30)
on conflict (code) do update
set label=excluded.label,
    sort_order=excluded.sort_order;

alter table public.business_fronts enable row level security;
drop policy if exists central_business_fronts_select_active_user on public.business_fronts;
create policy central_business_fronts_select_active_user
on public.business_fronts
for select
to authenticated
using (public.central_is_active_user(auth.uid()));

grant select on public.business_fronts to authenticated;

create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  employee_code text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personnel_display_name_idx
  on public.personnel (lower(trim(display_name)));

create unique index if not exists personnel_employee_code_uq
  on public.personnel (employee_code)
  where employee_code is not null and trim(employee_code) <> '';

alter table public.personnel enable row level security;
drop policy if exists central_personnel_select_active on public.personnel;
create policy central_personnel_select_active
on public.personnel
for select
to authenticated
using (public.central_is_active_user(auth.uid()) and active);

grant select on public.personnel to authenticated;

alter table public.profiles
  add column if not exists personnel_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='profiles_personnel_id_fkey'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_personnel_id_fkey
      foreign key (personnel_id)
      references public.personnel(id)
      on delete set null;
  end if;
end $$;

-- Cria registros de colaborador para os perfis existentes.
insert into public.personnel (display_name,active)
select p.display_name, bool_or(p.active)
from public.profiles p
join auth.users u on u.id=p.id
where nullif(trim(p.display_name),'') is not null
  and lower(coalesce(u.email,'')) not like '%@centralmanutencao.test'
  and lower(trim(p.display_name)) <> 'teste'
  and not exists (
    select 1
    from public.personnel pe
    where lower(trim(pe.display_name))=lower(trim(p.display_name))
  )
group by p.display_name;

-- Vincula perfis existentes pelo nome exato normalizado.
update public.profiles p
set personnel_id = (
  select pe.id
  from public.personnel pe
  where lower(trim(pe.display_name))=lower(trim(p.display_name))
  order by pe.created_at, pe.id
  limit 1
)
where p.personnel_id is null
  and nullif(trim(p.display_name),'') is not null;

alter table public.maintenance_reports
  add column if not exists business_front text not null default 'substation';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='maintenance_reports_business_front_check'
      and conrelid='public.maintenance_reports'::regclass
  ) then
    alter table public.maintenance_reports
      add constraint maintenance_reports_business_front_check
      check (business_front in ('substation','distribution','telecom'));
  end if;
end $$;

create index if not exists maintenance_reports_business_front_idx
  on public.maintenance_reports (business_front, created_at desc);

create table if not exists public.maintenance_report_participants (
  report_id uuid not null references public.maintenance_reports(id) on delete cascade,
  personnel_id uuid not null references public.personnel(id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (report_id, personnel_id)
);

create index if not exists maintenance_report_participants_personnel_idx
  on public.maintenance_report_participants (personnel_id, report_id);

alter table public.maintenance_report_participants enable row level security;

drop policy if exists central_report_participants_select_active on public.maintenance_report_participants;
create policy central_report_participants_select_active
on public.maintenance_report_participants
for select
to authenticated
using (public.central_is_active_user(auth.uid()));

drop policy if exists central_report_participants_insert_owner_admin on public.maintenance_report_participants;
create policy central_report_participants_insert_owner_admin
on public.maintenance_report_participants
for insert
to authenticated
with check (
  public.central_is_active_user(auth.uid())
  and exists (
    select 1
    from public.maintenance_reports r
    where r.id=report_id
      and (r.author_id=auth.uid() or public.central_is_admin(auth.uid()))
  )
);

drop policy if exists central_report_participants_update_owner_admin on public.maintenance_report_participants;
create policy central_report_participants_update_owner_admin
on public.maintenance_report_participants
for update
to authenticated
using (
  exists (
    select 1
    from public.maintenance_reports r
    where r.id=report_id
      and (r.author_id=auth.uid() or public.central_is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.maintenance_reports r
    where r.id=report_id
      and (r.author_id=auth.uid() or public.central_is_admin(auth.uid()))
  )
);

drop policy if exists central_report_participants_delete_owner_admin on public.maintenance_report_participants;
create policy central_report_participants_delete_owner_admin
on public.maintenance_report_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.maintenance_reports r
    where r.id=report_id
      and (r.author_id=auth.uid() or public.central_is_admin(auth.uid()))
  )
);

grant select,insert,update,delete
on public.maintenance_report_participants
to authenticated;

-- Relatórios existentes ficam vinculados ao autor como participante inicial.
-- Isso não tenta interpretar as antigas strings livres de equipe.
insert into public.maintenance_report_participants (report_id,personnel_id,position)
select r.id,p.personnel_id,1
from public.maintenance_reports r
join public.profiles p on p.id=r.author_id
where p.personnel_id is not null
on conflict (report_id,personnel_id) do nothing;

comment on table public.business_fronts is
  'Frentes de negócio da Central de Manutenção. Na v2.0.0 somente Subestações está habilitada.';
comment on table public.personnel is
  'Cadastro de colaboradores independente de contas de autenticação.';
comment on column public.profiles.personnel_id is
  'Vínculo opcional entre uma conta e um colaborador do cadastro de equipe.';
comment on table public.maintenance_report_participants is
  'Integrantes da equipe executante, normalizados e independentes da autoria do relatório.';
comment on column public.maintenance_reports.business_front is
  'Frente de negócio do atendimento: substation, distribution ou telecom.';

commit;
