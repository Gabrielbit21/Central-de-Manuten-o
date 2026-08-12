-- Central de Manutenção SE v1.5.1
-- Consolida o fluxo de criação de perfil para qualquer e-mail válido.
-- Idempotente: CREATE OR REPLACE FUNCTION.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_provisioned boolean := false;
begin
  begin
    v_provisioned := coalesce((new.raw_app_meta_data ->> 'central_provisioned')::boolean, false);
  exception when others then
    v_provisioned := false;
  end;

  if v_provisioned then
    insert into public.profiles (
      id, display_name, role, requested_role, active,
      approval_status, must_change_password, approved_at
    ) values (
      new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), new.email, 'Usuário'),
      'field', 'field', true,
      'approved', true, now()
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      active = true,
      approval_status = 'approved',
      updated_at = now();

    return new;
  end if;

  insert into public.profiles (
    id, display_name, role, requested_role, active,
    approval_status, must_change_password, approved_at, approved_by
  ) values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), new.email, 'Usuário'),
    'field', 'field', false,
    'pending', false, null, null
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = 'field',
    requested_role = 'field',
    active = false,
    approval_status = 'pending',
    approved_at = null,
    approved_by = null,
    updated_at = now();

  return new;
end;
$function$;
