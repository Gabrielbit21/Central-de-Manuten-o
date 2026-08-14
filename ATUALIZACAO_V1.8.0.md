# Central de Manutenção SE — atualização v1.8.0

## Objetivo

Homologação final de UI/UX sobre a v1.7.0. Esta versão consolida os últimos refinamentos visuais e de navegação identificados na validação em notebook/desktop, sem alterar banco de dados ou infraestrutura.

## Principais ajustes

- **Visão geral** passa a se chamar **Relatórios** no menu, Home, mobile e título da página.
- Menu **Mais** no cabeçalho desktop/notebook só aparece quando algum item realmente precisa ser recolhido por falta de espaço ou aumento de zoom.
- Maior respiro entre a logo, o grupo de navegação e os próprios botões do cabeçalho.
- Botão **X** do painel de perfil padronizado visualmente com os demais fechamentos.
- Tabela de usuários alinhada em cinco colunas coerentes: **Usuário, Último acesso, Perfil, Status e Ações**.
- KPIs da tela **Relatórios** refinados para o mesmo padrão corporativo das demais áreas.
- Bloco técnico `CMSE_EXPORT_V1` removido da interface de **Exportar dados**; o contrato continua preservado internamente e no Excel.
- `APP_VERSION`, build, `version.json` e Service Worker sincronizados em **1.8.0**.

## Como atualizar a partir da v1.7.0

1. **Não execute SQL.**
2. **Não publique Edge Functions.**
3. **Não altere Supabase, Brevo/SMTP, Push, VAPID ou Secrets.**
4. Extraia o ZIP da v1.8.0.
5. Envie todo o conteúdo interno da pasta extraída para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
6. Faça o commit.
7. Aguarde o GitHub Pages atualizar.
8. No desktop/notebook, use `Ctrl + F5`.
9. No PWA/celular, feche completamente o aplicativo e abra novamente.

Commit sugerido:

```text
Central de Manutenção SE v1.8.0 - homologação final UI UX
```

## Roteiro rápido de homologação

Validar nesta ordem:

1. Cabeçalho em notebook/desktop com zoom 100%: todos os módulos devem aparecer e **Mais** deve ficar oculto se não houver item recolhido.
2. Aumentar o zoom: **Mais** deve aparecer apenas quando algum módulo sair do cabeçalho.
3. Abrir o perfil: o **X** deve ter o mesmo padrão visual dos demais modais.
4. Abrir **Relatórios**: conferir nome novo e KPIs refinados.
5. Abrir **Usuários**: conferir alinhamento `Usuário | Último acesso | Perfil | Status | Ações`.
6. Abrir **Banco de Dados → Exportar dados**: confirmar que o painel abre e que a mensagem técnica `CMSE_EXPORT_V1` não aparece.
7. Conferir celular e notebook para garantir ausência de regressão responsiva.
