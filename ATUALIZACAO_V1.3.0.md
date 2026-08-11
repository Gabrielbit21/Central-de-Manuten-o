# Atualização para v1.3.0

Esta versão altera o cadastro para aceitar qualquer e-mail válido e adiciona código de convite administrativo como contingência.

## Partindo da v1.2.0 já configurada
1. Mantenha o SMTP Brevo e o template Confirm sign up já configurados.
2. Publique `admin-users` e `invite-signup`.
3. Execute apenas `supabase/migrations/20260811_email_free_and_invites.sql`.
4. Publique os arquivos da v1.3.0 no GitHub Pages.
5. Teste primeiro o cadastro por OTP e depois um cadastro com código de convite.

## Deploy
```bat
npx supabase functions deploy admin-users --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
npx supabase functions deploy invite-signup --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
```

Não gere novas chaves VAPID e não altere o SMTP Brevo.
