# Central de Manutenção SE — atualização v1.8.1

## Objetivo

Patch visual sobre a v1.8.0 para fechar os últimos detalhes encontrados na homologação. Não altera banco de dados, Edge Functions, SMTP/Brevo, Push ou VAPID.

## Alterações

- Foto do perfil passa a respeitar um avatar circular real, sem distorção ou recorte retangular.
- Botão de câmera continua sobreposto ao avatar para troca de foto.
- Todos os botões **X** de modais/containers seguem o mesmo padrão visual do detalhe do PAM: simples, transparente e sem caixa/sombra.
- Padronização aplicada inclusive a Perfil, Exportar dados, Atualização em massa, Notificações e demais modais.
- Navegação superior recebe mais respiro horizontal entre os módulos.
- O espaçamento continua adaptativo: quando faltar largura/zoom, o mecanismo de menu recolhe itens em vez de permitir sobreposição.

## Como atualizar

1. Não execute SQL.
2. Não publique Edge Functions.
3. Não altere SMTP/Brevo, Push, VAPID ou Secrets.
4. Envie todo o conteúdo da v1.8.1 para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
5. Faça o commit.
6. Aguarde o GitHub Pages atualizar.
7. No desktop/notebook, use `Ctrl + F5`.
8. No PWA/celular, feche completamente o aplicativo e abra novamente.

## Validação sugerida

- Abrir Perfil e conferir avatar circular + câmera.
- Abrir Detalhe PAM e Exportar dados e comparar os botões X: devem ser visualmente idênticos.
- Conferir o menu superior em notebook/desktop e aumentar o zoom para validar o recolhimento responsivo dos módulos.
