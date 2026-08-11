# Web Push — Central de Manutenção SE v1.3.0

A v1.3.0 usa Web Push padrão com Service Worker, VAPID e Supabase Edge Functions.

## Secrets

Em **Supabase → Edge Functions → Secrets**:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — exemplo: `mailto:usuario@exemplo.com`
- `CENTRAL_WEBHOOK_SECRET`

No **Vault**, mantenha `central_webhook_secret` com exatamente o mesmo valor de `CENTRAL_WEBHOOK_SECRET`.

## Edge Functions

Publique:

```bash
npx supabase functions deploy admin-users --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
npx supabase functions deploy push-config --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
npx supabase functions deploy push-dispatch --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
```

## Migration final

Depois das migrations anteriores, execute:

```text
supabase/migrations/20260811_release_candidate.sql
```

Ela:

- remove `trg_maintenance_reports_whatsapp_events`;
- reinstala um único `trg_maintenance_reports_push_events`;
- garante `push_notification_dispatch` na fila;
- corrige os privilégios de `service_role`;
- mantém RLS da Central de Notificações;
- libera o fluxo de conta verificada por e-mail.

## Teste rápido

1. Entre na Central.
2. Abra o avatar → perfil.
3. Clique em **Ativar neste dispositivo**.
4. Autorize o navegador.
5. Envie um relatório com outro usuário.
6. O administrativo deve receber uma única notificação de novo relatório.

Consulta de diagnóstico:

```sql
select event_type, provider, status, attempts, last_error, created_at
from public.notification_outbox
order by created_at desc
limit 20;
```

Assinaturas:

```sql
select user_id, platform, active, created_at, last_seen_at, last_success_at, last_error
from public.push_subscriptions
order by created_at desc;
```

## iPhone/iPad

Para receber Web Push no iPhone/iPad, adicione a Central à Tela de Início e abra pelo ícone instalado antes de ativar as notificações.
