# Central de Manutenção SE — atualização v1.6.1

## Objetivo

Patch visual sobre a v1.6.0 para corrigir a composição do cabeçalho em notebooks e suavizar a apresentação dos cards da tela inicial.

## Alterações

- Cabeçalho desktop/notebook reorganizado em quatro áreas reais: marca, navegação, menu “Mais” e controles do usuário.
- Correção do problema em que avatar/status/sair podiam cair para uma segunda linha em larguras intermediárias.
- Altura e espaçamentos do cabeçalho reduzidos em notebooks.
- Navegação compactada progressivamente entre desktop, notebook e tablet sem alterar o layout mobile.
- Cards da tela inicial voltam a usar borda neutra no estado normal.
- Cor temática da borda e sombra aparecem somente no hover/foco em dispositivos com mouse.
- Em telas touch/celular os cards permanecem neutros, evitando estados de hover “presos”.
- Versão do aplicativo, build e Service Worker sincronizados em v1.6.1.

## Como atualizar

1. Não execute SQL.
2. Não publique Edge Functions.
3. Não altere Supabase, SMTP/Brevo, Push, VAPID ou Secrets.
4. Envie todo o conteúdo da v1.6.1 para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
5. Faça o commit.
6. Aguarde o GitHub Pages atualizar.
7. No notebook/desktop, use `Ctrl + F5`.
8. No PWA/celular, feche completamente e abra novamente.

## Teste recomendado

- Notebook em janela maximizada e também com o navegador um pouco mais estreito.
- Confirmar que logo, menu, “Mais”, sino/avatar/status/sair permanecem todos na mesma linha.
- Passar o mouse sobre os cards da home e verificar que a borda colorida aparece apenas no hover.
- Conferir celular para garantir que os cards continuam com bordas neutras e a navegação inferior permanece normal.
