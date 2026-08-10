# Central de Manutenção SE — HOMOLOGAÇÃO v1.1.1

Versão de homologação com notificações **Web Push** e Central de Notificações interna.

## Principais recursos

- Telefone/WhatsApp permanece como dado cadastral de todos os usuários.
- Notificações externas usam Web Push, sem WhatsApp Cloud API e sem tarifa de mensageria da Meta.
- Cada usuário ativa o Push individualmente em cada computador ou celular.
- Administrativo recebe:
  - novo relatório recebido;
  - relatório corrigido e reenviado.
- Equipe de Campo recebe:
  - confirmação de recebimento;
  - relatório aprovado;
  - relatório devolvido para correção.
- Sino no topo com contador de não lidas.
- Central de Notificações com leitura individual.
- Fila `notification_outbox` com idempotência e reenvio controlado.
- Vários dispositivos Push podem ser cadastrados para o mesmo usuário.
- Painel administrativo mostra quantos dispositivos Push ativos cada usuário possui.

## Arquitetura

`maintenance_reports` → trigger de eventos → `notification_outbox` → trigger `pg_net` → Edge Function `push-dispatch` → Push Service do navegador → dispositivo.

A `notification_outbox` também alimenta a Central de Notificações dentro do aplicativo.

## Backend

Edge Functions utilizadas:

- `admin-users`
- `push-config`
- `push-dispatch`

Migrations:

- `20260810_whatsapp_notifications.sql` — base histórica da fila e preferências.
- `20260810_web_push_notifications.sql` — migração para Web Push.
- `20260810_push_dispatch_trigger.sql` — trigger seguro de despacho via Vault + `pg_net`.

## Front-end / GitHub Pages

Publique na mesma raiz:

- `index.html`
- `version.json`
- `.nojekyll`
- `manifest.webmanifest`
- `sw.js`
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`

A pasta `supabase/` deve permanecer versionada no repositório.

## Configuração

Consulte `PUSH_SETUP.md` para o passo a passo completo de implantação e homologação.

> A v1.1.1 corrige a inconsistência do front-end da v1.1.0: agora o Service Worker é registrado e mantido, o Push pode ser ativado/desativado por dispositivo e a interface usa `push_notifications_enabled` corretamente.
