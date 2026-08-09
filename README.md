# Central de Manutenção SE — Homologação v0.9.1

Ambiente de homologação da Central de Manutenção de Ativos de Subestação.

## Novidades

A v0.9.1 muda o provisionamento para **autocadastro com aprovação administrativa**. O próprio usuário solicita acesso usando e-mail corporativo, nome, senha e o perfil desejado (Equipe de Campo ou Administrativo). A conta permanece bloqueada até a aprovação.

Também foi adicionado **logout diário automático**: a sessão é válida somente até a virada do dia no fuso `America/Sao_Paulo`. Rascunhos locais são preservados antes do encerramento.

## Backend obrigatório

Execute `Supabase_Autocadastro_Aprovacao_v0.9.1.sql` e crie ou atualize a Edge Function `admin-users` com o arquivo v0.9.1 antes de publicar o novo `index.html`.

Enquanto não houver SMTP corporativo, mantenha a confirmação de e-mail desabilitada no Supabase Auth para a homologação. A aprovação administrativa continua obrigatória.

Não publique chaves secret/service_role no GitHub.
