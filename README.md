# Central de Manutenção SE — v1.5.2 Homologação

Release consolidada de refinamento da Central de Manutenção de ativos de subestação.

## Principais recursos

- manutenção e histórico de ativos por subestação;
- fluxo administrativo e de equipe de campo;
- funcionamento offline com sincronização posterior;
- fotos, relatórios, correções, aprovação e devolução controlada;
- Central de Notificações e Web Push por dispositivo;
- preferências de notificações por usuário;
- criação de conta com validação de e-mail por código OTP;
- gestão administrativa de usuários e promoção de perfil;
- PWA para instalação pelo navegador;
- ícone oficial preparado para PWA e futuro empacotamento Windows/Android.

## Ordem de atualização a partir da v1.1.1

1. Publique/atualize as Edge Functions:
   - `admin-users`
   - `push-config`
   - `push-dispatch`
2. Execute `supabase/migrations/20260811_release_candidate.sql`.
3. Configure a confirmação de e-mail/SMTP conforme `EMAIL_VERIFICATION_SETUP.md`.
4. Suba os arquivos desta versão para a raiz do GitHub Pages.
5. Faça `Ctrl+F5` ou feche/reabra a PWA para carregar o novo Service Worker.

## Secrets mantidos

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CENTRAL_WEBHOOK_SECRET`

O Vault deve continuar contendo `central_webhook_secret` com o mesmo valor de `CENTRAL_WEBHOOK_SECRET`.

## WhatsApp

O telefone/WhatsApp permanece apenas como dado cadastral. Nenhum envio pela Meta/WhatsApp é utilizado nesta versão.

As antigas Edge Functions `whatsapp-dispatch` e `whatsapp-webhook` podem ser removidas do projeto Supabase depois da validação da v1.4.0.

## Empacotamento

`assets/icons/app-icon-source.png` é a arte oficial. `assets/icons/central-manutencao.ico` já fica preparado como base do instalador Windows; os PNGs são usados no PWA/Android.


## v1.4.0

Refinamento da experiência inicial: saudação pelo primeiro nome, resumo operacional inteligente por perfil, cabeçalho corporativo mais espaçado, sino de notificações simplificado e indicador de homologação movido para o rodapé.

Para atualizar a partir da v1.3.0, consulte `ATUALIZACAO_V1.4.0.md`. Não há nova migration nem novo deploy de Edge Function nesta release.

## v1.3.0
Cadastro com qualquer e-mail válido, OTP via SMTP customizado e código de convite administrativo de uso único como contingência.


## Exportação e padronização de dados — v1.5.0

O Banco de Dados possui exportação Excel padronizada para ativos e manutenções. O contrato `CMSE_EXPORT_V1` mantém nomes e ordem de campos estáveis e inclui dicionário de dados. A base passa a registrar uma família funcional por ativo (`SUBESTACAO`, `REPETIDORA`, `RELIGADOR_DISTRIBUICAO`), permitindo a evolução futura sem quebrar as exportações atuais.
