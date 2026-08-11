# v1.3.0 — 2026-08-11

- Cadastro aceita qualquer e-mail válido.
- Mantém OTP de 6 dígitos via Supabase Auth/SMTP customizado.
- Adiciona códigos de convite administrativos de uso único e expiração configurável.
- Adiciona Edge Function `invite-signup`.
- Remove restrições remanescentes ao domínio `@energisa.com.br` no autoatendimento e criação administrativa.

# Changelog

## v1.2.0 — 2026-08-11

### Conta e autenticação
- “Solicitar acesso” renomeado para **Criar conta**.
- Cadastro por e-mail corporativo com código OTP de 6 dígitos.
- Conta liberada imediatamente após confirmação do e-mail.
- Autoatendimento cria somente perfil **Equipe de Campo**; privilégios administrativos continuam controlados por administradores.
- Reenvio de código com intervalo mínimo de 60 segundos.
- Removidos textos de aprovação administrativa do fluxo de autoatendimento.
- Removido texto explicativo abaixo do campo WhatsApp.

### Perfil e Push
- Avatar passa a ser o próprio controle para alteração da foto.
- Eliminada repetição de e-mail no cabeçalho do perfil.
- Um único botão alterna entre **Ativar neste dispositivo** e **Desativar neste dispositivo**.
- Removido indicador redundante “Ativo neste dispositivo”.
- Push ativo é ressincronizado silenciosamente, sem aviso repetitivo a cada abertura.
- Nenhuma solicitação de permissão é disparada automaticamente; a permissão só é pedida por ação do usuário.

### Central de Notificações
- Removido botão X redundante do modal.
- Toque/clique fora e tecla Esc fecham o modal.
- “Marcar todas como lidas” só aparece quando há notificações não lidas.
- Estado vazio mais compacto e refinado.

### Interface
- Cabeçalho desktop reorganizado para evitar sobreposição entre navegação, notificações, avatar e status.
- Versão exibida no cabeçalho sincronizada com v1.2.0.
- Refinamentos responsivos do modal de perfil e notificações.

### Backend
- Trigger antigo do WhatsApp removido de forma definitiva.
- Trigger Web Push consolidado como único gerador de eventos.
- Grants de `service_role` corrigidos para `push_subscriptions`, `notification_outbox`, `substations` e `profiles`.
- Notificações antigas presas em `sending` são marcadas como falha recuperável.
- RPC seguro `finalize_verified_self_signup()` adicionado.

### Identidade visual
- Novo PNG fornecido para o aplicativo aplicado aos ícones PWA.
- Gerado `central-manutencao.ico` para futuro pacote Windows.
