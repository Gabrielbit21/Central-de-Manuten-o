# Central de Manutenção SE — Homologação v0.9.0

Ambiente de homologação da Central de Manutenção de Ativos de Subestação.

## Novidade principal

A v0.9.0 adiciona **Gestão de Usuários** administrativa: criação de acesso, definição de perfil, ativação/desativação, senha temporária, redefinição de senha e troca obrigatória no primeiro login.

## Backend obrigatório

Antes de testar o módulo, execute `Supabase_Gestao_Usuarios_v0.9.0.sql` e publique a Edge Function `admin-users` fornecida no pacote de backend. A credencial privilegiada fica somente no Supabase Edge Functions.

## Homologação

A aplicação continua conectada ao mesmo projeto Supabase e deve ser publicada no GitHub Pages a partir do `index.html` na raiz.

Não publique chaves secret/service_role no GitHub.
