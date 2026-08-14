# Central de Manutenção SE — atualização v1.7.0

## Objetivo

Consolidação dos refinamentos de homologação identificados em notebook/desktop, PAM, notificações, usuários e Banco de Dados. Esta versão é **somente de front-end**.

## Principais ajustes

- Cabeçalho adaptativo: os módulos aparecem diretamente após a logo quando houver espaço; **Mais** surge somente quando o viewport/zoom exigir compactação.
- Perfil/preferências e atualização em massa com **X** visível no topo do painel.
- Central de Notificações com sino real e cabeçalho mais compacto.
- Modais não fecham por clique externo.
- PAM com tabela mais contida e corporativa, **Competência → Mês**, status colorindo a célula inteira e correção do filtro da última coluna.
- Tela de usuários/acessos com visual mais executivo, sem banner técnico de Web Push/VAPID e com botões refinados.
- Correção funcional do botão **Exportar dados**.
- KPIs do Banco de Dados reposicionados em indicadores compactos junto ao cabeçalho.

## Como atualizar

1. **Não execute SQL.**
2. **Não publique Edge Functions.**
3. Não altere SMTP/Brevo, VAPID, Push ou Secrets.
4. Envie todo o conteúdo da v1.7.0 para a raiz do mesmo repositório GitHub, substituindo os arquivos existentes.
5. Faça o commit e aguarde o GitHub Pages atualizar.
6. No notebook/desktop, use `Ctrl + F5`.
7. No PWA/celular, feche completamente e abra novamente.

## Homologação sugerida

- Testar cabeçalho com zoom 100%, 125% e 150%.
- Abrir Perfil e Atualização em massa e confirmar o **X**.
- Abrir Notificações e conferir o ícone de sino.
- Abrir PAM, testar filtros de todas as colunas, principalmente **Data informada**.
- Abrir Usuários e conferir botões, filtros e lista.
- Abrir Banco de Dados → **Exportar dados** e gerar um `.xlsx`.
