# Central de Manutenção SE — atualização v1.8.2

## Objetivo

Patch final de acabamento visual sobre a v1.8.1. Não altera banco de dados, Edge Functions, SMTP/Brevo, Push ou VAPID.

## Alterações

- Avatar do perfil travado em proporção 1:1, com círculo perfeito em desktop, notebook e celular.
- Imagem do avatar usando `object-fit: cover`, sem deformação.
- Botão de câmera preservado sobre o canto inferior do avatar.
- Removido o indicador redundante “Internet disponível / Modo local” da tela Nova Manutenção. O status de conectividade continua disponível no cabeçalho do sistema.

## Como atualizar

1. Não execute SQL.
2. Não publique Edge Functions.
3. Não altere SMTP/Brevo, Push, VAPID ou Secrets.
4. Envie todo o conteúdo da v1.8.2 para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
5. Faça o commit.
6. Aguarde o GitHub Pages atualizar.
7. Recarregue com `Ctrl + F5`.
