# Central de Manutenção SE — atualização v1.6.0

## Objetivo

Refino estético e de usabilidade sobre a v1.5.2, sem mudanças de banco, Edge Functions ou configurações de infraestrutura.

## Alterações

- Cards da home com bordas coloridas na mesma família visual dos ícones.
- Banco de Dados com KPIs reposicionados abaixo dos filtros.
- Botões “Exportar dados” e “Atualização em massa” destacados em laranja com linguagem visual de planilha.
- Modal de exportação simplificado, com fechamento principal via **X** no canto superior.
- Central de notificações e menu mobile com botão **X** dedicado.
- Fechamento por clique fora do painel removido dos principais modais/painéis.
- Higienização visual do campo de código de validação, com placeholder em traços.
- Agrupamento de equipes na exportação com normalização de nomes para reduzir duplicidades por variação de escrita/separadores.

## Como atualizar

1. Não execute SQL.
2. Não publique Edge Functions.
3. Não altere SMTP/Brevo, Push, VAPID ou Secrets.
4. Envie todo o conteúdo da v1.6.0 para a raiz do mesmo repositório GitHub, substituindo os arquivos atuais.
5. Faça o commit.
6. Aguarde o GitHub Pages atualizar.
7. No desktop/notebook, recarregue com `Ctrl + F5`.
8. No PWA/celular, feche completamente o aplicativo e abra novamente.

## Teste de homologação

Validar principalmente:

- home com bordas dos cards harmonizadas com os ícones;
- Banco de Dados com os KPIs abaixo da barra de filtros;
- modal de exportação abrindo e fechando apenas pelo **X**;
- central de notificações e menu mobile com **X** visível;
- exportação agrupando corretamente equipes com nomes equivalentes.
