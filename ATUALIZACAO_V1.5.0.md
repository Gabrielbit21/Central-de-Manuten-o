# Central de Manutenção SE — atualização v1.5.0

## O que entrou

- Exportação Excel da Base de Ativos.
- Exportação de Manutenções por período, equipe, local e status.
- Histórico de manutenção por ativo.
- Workbook consolidado com Informações, Resumo, Ativos, Manutenções, Resumo por Equipe e Dicionário de Dados.
- Contrato de exportação `CMSE_EXPORT_V1`, com colunas fixas para preservar compatibilidade futura.
- Preparação da base multi-família: `SUBESTACAO`, `REPETIDORA` e `RELIGADOR_DISTRIBUICAO`. Somente Subestação permanece ativa nesta etapa.
- Padronização inspirada nas planilhas legadas de cadastro e atendimento usadas no projeto, preservando campos comuns como empresa, região, local, tipo, fabricante, modelo, número de série, número operativo, equipe e dados da manutenção.

## Atualização

1. Faça backup do projeto Supabase.
2. No **SQL Editor**, execute **somente** `supabase/migrations/20260812_asset_families_and_exports.sql`.
3. Não é necessário publicar novas Edge Functions nesta versão.
4. Suba todo o conteúdo deste pacote para a raiz do repositório GitHub Pages.
5. Aguarde a publicação e faça `Ctrl + F5`. Em PWA/mobile, feche totalmente o aplicativo e abra de novo.

## Como exportar

Abra **Banco de Dados → Exportar dados**. Escolha:

- **Base de ativos** — cadastro técnico padronizado.
- **Manutenções** — esta semana, mês atual, mês anterior, últimos 30 dias, período personalizado ou todo o período; filtros por equipe, local e status.
- **Histórico por ativo** — ficha cadastral + atendimentos vinculados.
- **Consolidado** — workbook para análises e arquivamento.

Cada arquivo inclui a aba `Dicionario_Dados` e uma aba `Informacoes` com data, usuário, versão do software e filtros aplicados.

## Observação sobre Excel offline

A exportação utiliza o módulo SheetJS já empregado pela Central. Na versão web atual, ele é carregado por CDN; portanto, recomenda-se que o dispositivo tenha feito ao menos uma abertura com acesso à internet. No empacotamento final `.exe`/`.apk`, o módulo deverá ser incorporado localmente para independência de rede.
