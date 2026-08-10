# Central de Manutenção SE v1.1.1 — Web Push

Esta versão substitui o envio por WhatsApp Cloud API por **Web Push padrão**. O telefone/WhatsApp continua como dado cadastral, mas não é usado para entregar notificações.

## Arquitetura

`maintenance_reports` → trigger SQL → `notification_outbox` → trigger `pg_net` → `push-dispatch` → Push Service do navegador → dispositivo do usuário.

A própria `notification_outbox` também funciona como Central de Notificações dentro do app, com leitura/não leitura por usuário.

## 1. Aplicar a migration v1.1.1

No Supabase SQL Editor, execute integralmente:

`supabase/migrations/20260810_web_push_notifications.sql`

Ela:
- adiciona `push_notifications_enabled` ao perfil;
- cria `push_subscriptions` para os dispositivos;
- mantém telefone/WhatsApp apenas como contato;
- transforma a fila em canal `web_push`;
- adiciona leitura individual das notificações;
- desativa o trigger antigo de WhatsApp e instala o trigger Web Push.

## 2. Gerar as chaves VAPID

No CMD/PowerShell, execute uma única vez:

```bat
npx web-push generate-vapid-keys --json
```

Guarde as duas chaves geradas. A chave pública pode ser exposta ao navegador; a privada deve ficar somente nos Secrets do Supabase.

## 3. Criar Secrets no Supabase

Em **Edge Functions → Secrets**, crie:

- `VAPID_PUBLIC_KEY` = chave pública gerada
- `VAPID_PRIVATE_KEY` = chave privada gerada
- `VAPID_SUBJECT` = um contato real, por exemplo `mailto:seu.email.corporativo@energisa.com.br`
- `CENTRAL_WEBHOOK_SECRET` = uma sequência longa e aleatória, diferente das chaves VAPID

Não coloque esses valores reais no GitHub.

## 4. Publicar as Edge Functions

Na pasta do projeto:

```bat
npx supabase functions deploy admin-users --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
npx supabase functions deploy push-config --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
npx supabase functions deploy push-dispatch --project-ref szshskfyocsumvmqwuem --use-api --no-verify-jwt
```

`admin-users` continua validando a sessão e o perfil administrativo dentro da própria função.

## 5. Trigger de despacho Push

Como o Dashboard atual pode não exibir Database Webhooks, use o Vault + SQL:

1. Em **Integrations → Vault**, crie `central_webhook_secret` com o MESMO valor de `CENTRAL_WEBHOOK_SECRET`.
2. No SQL Editor, execute `supabase/migrations/20260810_push_dispatch_trigger.sql`.
3. Confirme que existe `push_notification_dispatch | INSERT | notification_outbox`.

O trigger usa `pg_net` para chamar `push-dispatch` de forma assíncrona e lê o secret no Vault, sem gravá-lo em texto aberto no SQL.

## 6. Publicar o front-end no GitHub Pages

Além dos arquivos que já existiam, a v1.1.1 precisa que estes arquivos sejam publicados na mesma raiz do `index.html`:

- `manifest.webmanifest`
- `sw.js`
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`

A pasta `supabase/` deve continuar versionada no repositório.

## 7. Ativar notificações em cada dispositivo

Cada usuário faz isso uma vez por dispositivo:

1. entrar na Central;
2. abrir **Meu perfil e notificações**;
3. tocar em **Ativar neste dispositivo**;
4. aceitar a permissão do navegador.

O usuário pode cadastrar mais de um dispositivo. O painel administrativo mostra quantos dispositivos ativos existem por usuário.

### iPhone/iPad

No iPhone/iPad, primeiro adicione a Central à **Tela de Início**, abra-a pelo ícone criado e só então ative as notificações no perfil.

## 8. Eventos implementados

Administrativo:
- novo relatório recebido;
- relatório corrigido e reenviado.

Equipe de Campo:
- confirmação de relatório recebido;
- relatório aprovado;
- relatório devolvido para correção.

As preferências continuam individuais por usuário.

## 9. Central de Notificações

O sino no topo do sistema mostra a quantidade não lida. Ao abrir uma notificação, ela é marcada como lida e o sistema tenta abrir o relatório correspondente.

O Web Push registra `sent` quando o Push Service aceitou a mensagem. Diferentemente do WhatsApp, o padrão Web Push não fornece confirmação universal de “entregue” e “lido” pelo sistema operacional. O status de leitura exibido pela Central representa a leitura dentro do próprio aplicativo.

## 10. Teste recomendado

1. Ative Push no dispositivo do administrador.
2. Ative Push no dispositivo de um usuário de campo.
3. Envie um relatório de teste pelo usuário de campo.
4. Confirme:
   - Push “Novo relatório recebido” no administrador;
   - Push “Relatório recebido” no usuário de campo;
   - duas entradas na Central de Notificações.
5. Aprove o relatório e confirme o Push de aprovação no campo.
6. Faça outro teste devolvendo para correção e confira o motivo no Push.

## 11. Meta/WhatsApp antigo

A v1.1.1 não precisa de cartão, WABA, Phone Number ID, token da Meta, templates ou webhook da Meta. As Edge Functions `whatsapp-dispatch` e `whatsapp-webhook` deixam de fazer parte do projeto.

Você pode manter o app Meta parado enquanto homologa a v1.1.1 e remover/desregistrar esses ativos depois, se não forem mais necessários.
