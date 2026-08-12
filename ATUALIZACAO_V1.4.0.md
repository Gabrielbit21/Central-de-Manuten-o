# Atualização para v1.4.0

Esta versão é um refinamento de **interface e inteligência da tela inicial** sobre a v1.3.0.

## Não precisa alterar o Supabase

Se a v1.3.0 já foi aplicada com sucesso, nesta atualização **não há nova migration, novo Secret ou nova Edge Function**.

Mantenha como estão:

- `admin-users`
- `invite-signup`
- `push-config`
- `push-dispatch`
- SMTP/Brevo
- template OTP
- chaves VAPID
- `CENTRAL_WEBHOOK_SECRET`

## Atualização

1. Extraia o ZIP da v1.4.0 em uma pasta nova.
2. Envie o conteúdo da pasta para a **raiz do mesmo repositório GitHub Pages**, substituindo os arquivos anteriores.
3. Faça o commit.
4. Aguarde o GitHub Pages publicar.
5. No desktop, use `Ctrl+F5`.
6. Na PWA/celular, feche completamente e abra de novo para o Service Worker carregar a build 1.4.0.

## O que mudou

- saudação inicial usa o primeiro nome cadastrado;
- mensagem inicial passa a exibir indicadores contextuais da semana;
- Equipe de Campo vê quantidade de relatórios registrados e devoluções pendentes;
- Equipe Administrativa vê relatórios recebidos na semana e pendências de conferência;
- cabeçalho desktop recebe mais respiro e aproveita melhor telas largas;
- `HOMOLOGAÇÃO` deixa o cabeçalho e passa para um rodapé discreto;
- notificações usam sino sem moldura pesada, mantendo somente o badge de não lidas;
- versão do aplicativo e Service Worker sincronizadas em 1.4.0.
