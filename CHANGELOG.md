# Changelog

## v3.1.3 — 2026-09-19 — Autenticação offline e revisão padronizada

- login sempre exige e-mail e senha; não há mais entrada direta por identidade ou sessão encontrada no dispositivo;
- quando a tela de login detecta ausência de conectividade, **Entrar** é ocultado e dá lugar a **Entrar offline**;
- o acesso offline usa um verificador local PBKDF2-SHA-256 com salt aleatório, criado somente após login online válido, sem armazenar a senha em texto;
- mantém a autorização offline por até 7 dias e a fila local para posterior sincronização;
- validação obrigatória passa a usar destaque discreto e remove o estado vermelho assim que o campo/grupo é corrigido;
- revisão de relatórios de Subestação, Distribuição e Telecom passa a usar as perguntas/rótulos reais dos formulários, agrupadas por seção;
- campos técnicos internos (IDs de participantes, JSONs e chaves auxiliares) deixam de aparecer na revisão;
- Web, Android, cache offline e identificadores de versão sincronizados em **3.1.3**.

## v3.1.2 — 2026-09-18 — Hotfix de acesso offline e validação de formulários

- corrigido o login offline em dispositivos já autorizados: o formulário não perde mais o fallback quando o bootstrap reinstala os eventos de autenticação;
- o acesso offline passa a funcionar também quando o aparelho está conectado a uma rede, mas o Supabase está temporariamente inacessível;
- o botão de acesso offline permanece disponível enquanto a autorização local de até 7 dias estiver válida;
- erros de rede no login deixam de exibir apenas `Failed to fetch` quando existe uma identidade offline válida;
- corrigida a validação de grupos obrigatórios condicionais: grupos ocultos ou desabilitados deixam de bloquear o envio do relatório;
- campos mascarados opcionais agora limpam `setCustomValidity()` quando ficam vazios, evitando falso erro obrigatório;
- campos e grupos inválidos recebem destaque vermelho, mensagem contextual e rolagem/foco automáticos no primeiro erro;
- a mesma experiência de validação é aplicada aos formulários de Subestação, Distribuição e Telecom;
- versões Web, Windows/Android e cache offline sincronizados em **3.1.2**.

## v3.1.1 — 2026-09-18 — Refinamentos das árvores e ficha canônica

- ramos **Eletrônicos**, **Relés**, **Pátio** e **Comunicação** passam a abrir e retrair de forma independente na árvore da Subestação;
- a busca continua expandindo automaticamente os ramos com resultados, sem apagar o estado manual do usuário;
- **Comunicação** passa a usar o mesmo estado de expansão das demais classes da árvore;
- a árvore da ficha de **Repetidora** passa a reutilizar o mesmo organograma visual da tela de Subestações;
- removido o nível intermediário **Religadores conectados**: os Religadores saem diretamente do nó da Repetidora;
- a quantidade de Religadores conectados passa a ser exibida dentro do próprio nó da Repetidora;
- o clique em um Religador vinculado passa a abrir a **ficha canônica existente**, eliminando a ficha paralela usada na v3.1.0;
- versões Web, Windows/Android e cache offline sincronizados em **3.1.1**.

## v3.1.0 — 2026-09-18 — Árvore de Comunicação

- **Comunicação** passa a ser um ramo nativo da árvore de cada Subestação, sem duplicar os registros canônicos de Telecom;
- ativos de Telecom vinculados por `telecom_site` e `substation_code` passam a aparecer também na visualização em lista e nas contagens da Subestação;
- busca da Subestação passa a localizar os ativos do ramo Comunicação;
- ficha de Repetidora passa a apresentar os religadores vinculados em um mapa visual de árvore, preservando a navegação para a ficha do religador;
- ficha canônica de `front_assets` é reutilizada ao abrir um ativo de Comunicação pela Subestação;
- versão de aplicativo, pacote Android e cache offline sincronizados em **3.1.0**.

## v1.9.0 — 2026-08-14 — Corporate Ready / Security Hardening

- removida a base operacional embarcada no frontend estático;
- removido o seed PAM do `index.html`;
- cache de snapshot isolado por usuário e limpo no encerramento de sessão;
- `profile_directory` criado para expor somente campos necessários dos demais perfis;
- migration de RLS/privilégio mínimo e Storage privado;
- PAM garantido no Supabase antes da retirada do fallback estático;
- Supabase JS e SheetJS passam a ser dependências locais do release preparado;
- CSP adicionada ao frontend;
- Service Worker passa a armazenar o app shell e bibliotecas locais para operação offline;
- documentação de prontidão corporativa e auditoria de segurança adicionadas.

## v1.8.2 — 2026-08-14

- avatar do perfil corrigido para círculo perfeito;
- indicador redundante de conectividade removido da tela Nova Manutenção.

## v1.8.1 — 2026-08-14

- avatar do perfil corrigido para formato circular real;
- fechamento dos modais padronizado no X simples do PAM;
- espaçamento horizontal da navegação superior ampliado mantendo fallback responsivo.

## v1.8.0 — 2026-08-14

- **Visão geral** renomeada para **Relatórios** no cabeçalho, Home, mobile e título da tela;
- menu **Mais** passa a aparecer somente quando houver itens realmente recolhidos por falta de espaço;
- maior respiro entre logo e navegação e entre os itens do cabeçalho;
- botão **X** do perfil padronizado visualmente com os demais fechamentos;
- tabela de Usuários alinhada em `Usuário | Último acesso | Perfil | Status | Ações`;
- mensagem técnica `CMSE_EXPORT_V1` removida da interface do painel de exportação, permanecendo no contrato/arquivo Excel;
- KPIs da tela Relatórios redesenhados no mesmo padrão executivo das demais áreas;
- build, versão do aplicativo e Service Worker sincronizados em 1.8.0.

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