# Changelog

## v1.1.1 — 2026-08-10
- Corrige o front-end Web Push da v1.1.0.
- Registra e mantém `sw.js` em vez de remover o Service Worker.
- Adiciona ativação/desativação de Push por dispositivo no perfil.
- Adiciona sino com contador e Central de Notificações.
- Usa `push_notifications_enabled` e `update_own_push_notification_preferences`.
- Atualiza a gestão administrativa para mostrar dispositivos Push ativos.
- Adiciona migration idempotente do trigger `push_notification_dispatch`.
- Mantém telefone/WhatsApp apenas como dado cadastral de contato.

— Central de Manutenção SE

## v1.0.0 — HOMOLOGAÇÃO

### WhatsApp e perfis
- WhatsApp passa a ser um dado cadastral para qualquer acesso: Administrativo ou Equipe de Campo.
- Novas solicitações de acesso exigem telefone/WhatsApp.
- Usuário pode editar o próprio WhatsApp e suas preferências de notificação.
- Gestão administrativa permite cadastrar, aprovar e editar telefone e preferências.
- Números são normalizados em E.164 no navegador/backend e novamente protegidos por normalização no banco.

### Notificações transacionais
- Novo relatório recebido → administradores habilitados.
- Confirmação de recebimento → autor do relatório.
- Relatório aprovado → autor do relatório.
- Relatório devolvido para correção → autor do relatório, incluindo o motivo.
- Relatório corrigido → administradores habilitados.
- Preferências individuais por evento e chave master para desativar WhatsApp.

### Backend e confiabilidade
- Nova fila `notification_outbox` com idempotência, tentativas, erros e status de entrega.
- Trigger de `maintenance_reports` cria os eventos automaticamente.
- Edge Function `whatsapp-dispatch` envia templates pela WhatsApp Cloud API.
- Edge Function `whatsapp-webhook` valida assinatura da Meta e atualiza `sent`, `delivered`, `read` ou `failed`.
- Edge Function `admin-users` ampliada para telefone, preferências, histórico e reenvio administrativo.
- Reenvio manual para falhas, limitado a 5 tentativas por notificação.
- Tokens e secrets ficam fora do front-end e do GitHub.

### Operação
- Painel “Usuários e WhatsApp” mostra cobertura de números e últimas notificações.
- Falhas exibem erro do provedor e ação de reenvio.
- Documentação completa de implantação adicionada em `WHATSAPP_SETUP.md`.

## v0.9.5 — HOMOLOGAÇÃO

### Refinamento visual
- Removida da tela inicial a tag `Acesso administrativo` / `Acesso de campo`.
- Botões de retorno das telas do fluxo passam a exibir somente a seta para a esquerda.
- Retorno com aparência mais clean e corporativa: fundo transparente em repouso, realce sutil no hover/foco e área de toque preservada.
- Adicionados rótulos de acessibilidade (`aria-label`) e dicas (`title`) aos retornos iconográficos.

### Mantido
- Todos os ajustes de autenticação, cache e atualização da v0.9.4.

## v0.9.4 — HOMOLOGAÇÃO

### Refinamento visual
- Removidos o título do sistema e o subtítulo da tela inicial de autenticação.
- Reduzida a logo Energisa na autenticação, com dimensões específicas para desktop e celular.
- Aumentado o respiro entre a marca e o card de login para uma composição mais limpa e corporativa.

### Mantido
- Controle de build e atualização por `version.json` da v0.9.3.
- Logo embutida no próprio HTML.
- Logout automático na virada do dia, sem texto explicativo permanente na tela de login.

## v0.9.3 — HOMOLOGAÇÃO
- Tratamento de cache/stale em navegadores móveis com verificação de versão.
- Remoção do registro incompleto de `service-worker.js`.
- Logo de autenticação embutida no HTML.

## v0.9.2 — HOMOLOGAÇÃO
- Logo da tela de login embutida no HTML.
- Removida a mensagem visual sobre encerramento diário da sessão.

## v0.9.1 — HOMOLOGAÇÃO
- Autocadastro com aprovação administrativa.
- Perfil solicitado pelo usuário.
- Logout diário automático.
