-- Central de Manutenção SE — v2.0.0
-- Pós-merge: índice de profiles.personnel_id e otimização de RLS/auth.uid().

begin;

create index if not exists profiles_personnel_id_idx
  on public.profiles (personnel_id)
  where personnel_id is not null;

drop policy if exists central_profiles_select_self on public.profiles;
create policy central_profiles_select_self
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists central_business_fronts_select_active_user on public.business_fronts;
create policy central_business_fronts_select_active_user
on public.business_fronts
for select
to authenticated
using (public.central_is_active_user((select auth.uid())));

drop policy if exists central_personnel_select_active on public.personnel;
create policy central_personnel_select_active
on public.personnel
for select
to authenticated
using (public.central_is_active_user((select auth.uid())) and active);

drop policy if exists central_reports_select_active on public.maintenance_reports;
create policy central_reports_select_active
on public.maintenance_reports
for select
to authenticated
using (public.central_is_active_user((select auth.uid())));

drop policy if exists central_reports_insert_own on public.maintenance_reports;
create policy central_reports_insert_own
on public.maintenance_reports
for insert
to authenticated
with check (
  public.central_is_active_user((select auth.uid()))
  and author_id = (select auth.uid())
);

drop policy if exists central_report_participants_select_active on public.maintenance_report_participants;
create policy central_report_participants_select_active
on public.maintenance_report_participants
for select
to authenticated
using (public.central_is_active_user((select auth.uid())));

drop policy if exists central_report_participants_insert_owner_admin on public.maintenance_report_participants;
create policy central_report_participants_insert_owner_admin
on public.maintenance_report_participants
for insert
to authenticated
with check (
  public.central_is_active_user((select auth.uid()))
  and exists (
    select 1
    from public.maintenance_reports r
    where r.id = report_id
      and (
        r.author_id = (select auth.uid())
        or public.central_is_admin((select auth.uid()))
      )
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
    where r.id = report_id
      and (
        r.author_id = (select auth.uid())
        or public.central_is_admin((select auth.uid()))
      )
  )
)
with check (
  exists (
    select 1
    from public.maintenance_reports r
    where r.id = report_id
      and (
        r.author_id = (select auth.uid())
        or public.central_is_admin((select auth.uid()))
      )
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
    where r.id = report_id
      and (
        r.author_id = (select auth.uid())
        or public.central_is_admin((select auth.uid()))
      )
  )
);

commit;
