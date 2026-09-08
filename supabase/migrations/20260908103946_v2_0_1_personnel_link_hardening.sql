-- Central de Manutenção SE — v2.0.1
-- Endurece a RPC de vínculo para aceitar somente perfis de Campo.

create or replace function public.admin_link_profile_personnel(
  p_profile_id uuid,
  p_personnel_id uuid
)
returns table (
  profile_id uuid,
  personnel_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_person public.personnel%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null
     or not public.central_is_active_user(v_uid)
     or not public.central_is_admin(v_uid) then
    raise exception 'A vinculação de colaborador é exclusiva da Equipe Administrativa.';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  if p_personnel_id is null then
    update public.profiles
       set personnel_id = null,
           updated_at = now()
     where id = p_profile_id;

    return query
    select p.id, p.personnel_id, p.display_name
    from public.profiles p
    where p.id = p_profile_id;
    return;
  end if;

  if coalesce(v_profile.role, 'field') <> 'field'
     or coalesce(v_profile.requested_role, 'field') <> 'field' then
    raise exception 'Somente contas da Equipe de Campo podem ser vinculadas a técnicos de campo.';
  end if;

  select * into v_person
  from public.personnel
  where id = p_personnel_id
    and active
    and is_field_technician;

  if not found then
    raise exception 'Técnico de campo inválido ou inativo.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.personnel_id = p_personnel_id
      and p.id <> p_profile_id
  ) then
    raise exception 'Este técnico já está vinculado a outra conta.';
  end if;

  update public.profiles
     set personnel_id = p_personnel_id,
         display_name = v_person.display_name,
         updated_at = now()
   where id = p_profile_id;

  return query
  select p.id, p.personnel_id, p.display_name
  from public.profiles p
  where p.id = p_profile_id;
end;
$$;

revoke all on function public.admin_link_profile_personnel(uuid, uuid) from public, anon;
grant execute on function public.admin_link_profile_personnel(uuid, uuid) to authenticated, service_role;

comment on function public.admin_link_profile_personnel(uuid, uuid) is
'Vincula uma conta de Campo ao cadastro canônico de técnico. Exige administrador ativo, rejeita perfis administrativos e impede que o mesmo técnico seja ligado a duas contas.';
