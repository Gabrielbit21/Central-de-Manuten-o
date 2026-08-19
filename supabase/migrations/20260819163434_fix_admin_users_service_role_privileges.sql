-- Hotfix v1.9.0: permissões necessárias para a Edge Function admin-users.
-- Esta migration replica a correção já aplicada no Supabase de produção.

grant update on table public.profiles to service_role;

grant select, insert on table public.user_admin_audit to service_role;
