# Padrão de Dados — Central de Manutenção SE v1.5.0

## Objetivo

Manter uma base única e evolutiva. A primeira família operacional é **Ativo de Subestação**, mas o contrato já reserva **Repetidora** e **Religador de Distribuição** para módulos futuros.

## Famílias

| Código | Nome | Situação nesta versão |
|---|---|---|
| `SUBESTACAO` | Ativo de Subestação | Ativa |
| `REPETIDORA` | Repetidora | Preparada / não exibida |
| `RELIGADOR_DISTRIBUICAO` | Religador de Distribuição | Preparada / não exibida |

## Núcleo cadastral comum

Os módulos futuros devem preservar, sempre que aplicável:

- ID permanente do ativo
- Família do ativo
- Empresa
- Região
- Local / instalação
- Sigla do local
- Categoria
- Tipo do ativo
- Localização funcional
- Circuito / referência operacional
- Fabricante
- Modelo
- Número de série
- Número operativo
- Identificação
- Observações
- Versão cadastral
- Última manutenção

Os campos foram definidos considerando a estrutura já utilizada nas planilhas de cadastro de Subestações, Equipamentos de Automação, Religadores e Atendimento em Ativos de Subestação fornecidas como referência ao projeto.

## Núcleo comum de manutenção

- ID permanente do relatório
- Número do relatório
- Data do atendimento
- Data de criação
- Família do ativo
- Local / sigla / região
- Equipe responsável
- Tipo de manutenção
- Ordem de serviço
- Horário de início e fim
- Ativos e IDs vinculados
- Status do relatório
- Resultado do atendimento
- Revisão
- Defeito
- Causa
- Reparo realizado
- Configuração
- Peça substituída / destino da peça
- Comentários
- Necessidade de retorno
- Motivo de devolução
- Fonte do registro

## Contrato de exportação

A versão atual do contrato é **`CMSE_EXPORT_V1`**.

Regras:

1. Os nomes das colunas comuns não devem ser renomeados em módulos futuros.
2. Novos campos específicos de uma família devem ser adicionados sem remover os campos comuns.
3. IDs de ativos e relatórios são permanentes e devem acompanhar exportações e integrações.
4. Toda exportação inclui uma aba `Informacoes` e uma aba `Dicionario_Dados`.
5. A família do ativo é explícita em todos os conjuntos exportados.
6. A ordem das colunas do contrato V1 permanece estável enquanto a versão do contrato não mudar.
