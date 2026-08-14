# Changelog

## v1.7.0 — 2026-08-14

- cabeçalho desktop/notebook com navegação completa ao lado da logo e menu **Mais** adaptativo somente quando faltar espaço;
- ícone real de sino na Central de Notificações e redução do espaço superior do modal;
- fechamento com **X** visível/ancorado nos painéis de perfil, atualização em massa e exportação;
- clique fora do painel não fecha modais;
- tabela PAM refinada, com melhor contenção horizontal, coluna **Mês**, status por célula colorida e filtro da última coluna reposicionado dentro da viewport;
- tela de Usuários refinada com linguagem visual corporativa, remoção do banner técnico de VAPID/Web Push e botões mais consistentes;
- botão **Exportar dados** corrigido para reabrir o painel de exportação;
- indicadores de Subestações/Ativos reposicionados em cards compactos no cabeçalho do Banco de Dados.

## v1.6.1 — 2026-08-13

- cabeçalho corrigido para notebooks e larguras intermediárias;
- marca, navegação, menu Mais e usuário mantidos na mesma linha;
- cards da home com borda temática apenas no hover/foco;
- comportamento touch preservado com bordas neutras.

## v1.6.0 — 2026-08-12

- cards da home com bordas coloridas por contexto;
- Banco de Dados com KPIs abaixo dos filtros;
- botões de exportação e atualização em massa destacados em laranja;
- modais principais com fechamento via X e sem fechar por clique externo;
- normalização de equipes na exportação para reduzir duplicidades;
- refinamento visual do campo de código de validação.

## v1.5.2 — Refinamento responsivo e OTP

- Campo de confirmação de e-mail fica visualmente limpo, sem o placeholder “Código recebido”.
- Mensagem após envio do OTP foi simplificada.
- Shell da aplicação padronizado para uma única superfície de rolagem vertical.
- Removida a margem negativa do rodapé de homologação, que podia gerar overflow vertical artificial.
- Página inicial ganhou alturas fluidas baseadas na viewport para notebook, desktop e widescreen.
- Ajustes específicos para telas desktop de pouca altura evitam rolagem sem necessidade.
- No celular, o rodapé de homologação fica acima da navegação fixa sem aumentar a altura do documento.
- Mantidos os comportamentos responsivos para celular, notebook e monitores largos.
- Build e Service Worker atualizados para 1.5.2.

## v1.5.1 — Correção do código OTP

- Corrigido o campo de confirmação de e-mail que limitava o OTP a 6 dígitos.
- O cadastro agora aceita o código numérico efetivamente enviado pelo Supabase Auth, sem assumir comprimento fixo.
- Textos da interface deixam de mencionar obrigatoriamente “6 dígitos”.
- Incluída migration de consolidação do `handle_new_user()` para manter cadastro com qualquer e-mail válido e perfil inicial de Equipe de Campo.
- Build e Service Worker atualizados para 1.5.1.

## v1.5.0 — Exportação padronizada e base evolutiva

- Novo módulo de exportação Excel no Banco de Dados.
- Filtros de manutenção por semana, mês, período personalizado, equipe, local, família e status.
- Histórico por ativo e workbook consolidado.
- Dicionário de dados `CMSE_EXPORT_V1` incluído nos arquivos.
- Nova tabela `asset_families` e campo `assets.family_code`.
- Famílias futuras preparadas sem expor módulos ainda não homologados.

# v1.4.0 — 2026-08-11

- Saudação inicial personalizada com o primeiro nome do usuário.
- Resumo semanal inteligente para Equipe de Campo e Equipe Administrativa.
- Equipe de Campo visualiza relatórios registrados na semana e devoluções pendentes.
- Equipe Administrativa visualiza relatórios recebidos na semana e pendências de conferência.
- Cabeçalho desktop com maior espaçamento e melhor aproveitamento da largura disponível.
- Indicador de homologação removido do cabeçalho e movido para rodapé discreto.
- Botão de notificações simplificado para sino sem moldura pesada.
- Build, APP_VERSION e Service Worker sincronizados em 1.4.0.

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