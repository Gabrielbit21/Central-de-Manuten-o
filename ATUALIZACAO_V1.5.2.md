# Central de Manutenção SE — atualização v1.5.2

## Objetivo

Patch de acabamento visual e responsivo sobre a v1.5.1. Não altera banco de dados, Edge Functions, SMTP/Brevo, Push ou VAPID.

## Alterações

- Campo OTP sem texto de placeholder que poluía a interface.
- Mensagem de código enviado mais curta.
- Rolagem vertical consolidada no documento, evitando scroll duplicado do shell.
- Altura da página inicial adaptada à viewport.
- Ajustes para notebooks com pouca altura, desktops e monitores widescreen.
- Ajustes móveis com `dvh/svh` e respeito à barra inferior/safe area.
- Rodapé de homologação reposicionado sem criar overflow artificial.

## Como atualizar

1. Não execute SQL.
2. Não publique Edge Functions.
3. Não altere SMTP/Brevo, Push, VAPID ou Secrets.
4. Envie todo o conteúdo da v1.5.2 para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
5. Faça o commit.
6. Aguarde o GitHub Pages atualizar.
7. No desktop/notebook, recarregue com `Ctrl + F5`.
8. No PWA/celular, feche completamente o aplicativo e abra novamente.

## Teste de homologação

Validar a tela inicial em:

- celular em orientação vertical;
- notebook;
- monitor 16:9;
- monitor widescreen/ultrawide.

A página deve ter somente a rolagem natural do navegador quando o conteúdo realmente ultrapassar a viewport. A tela inicial não deve criar uma segunda barra vertical interna.
