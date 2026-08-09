# Central de Manutenção SE — Homologação v0.9.2

Ambiente de homologação da Central de Manutenção de Ativos de Subestação.

## Ajustes da v0.9.2

- Corrigida definitivamente a logo da Energisa na tela de login.
- A logo da autenticação agora é embutida no próprio `index.html`, sem depender de arquivo externo no GitHub Pages.
- Removida da tela de login a mensagem informando que a sessão é encerrada na virada do dia.
- A lógica de logout diário continua ativa normalmente.

## Backend

Não há alteração de SQL ou Edge Function nesta versão. Continue usando o backend da v0.9.1 (`Supabase_Autocadastro_Aprovacao_v0.9.1.sql` e Edge Function `admin-users` v0.9.1).

Não publique chaves secret/service_role no GitHub.
