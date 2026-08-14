# Central de Manutenção SE — atualização v1.9.0 Corporate Ready

> **Revisão R3 (14/08/2026):** corrige a carga inicial do PAM na migration de hardening com casts explícitos para `date` (`planned_for`, `source_execution_date` e `completion_date`). A tentativa R2 que falhou antes do `commit` não deve ser reutilizada.

> **Revisão de segurança R2 (14/08/2026):** PRECHECK confirmou as travas administrativas em `public.is_admin()` e `apply_asset_update_internal()`. O helper interno de atualização de ativos é explicitamente bloqueado para `anon` e `authenticated`, e a auditoria/rollback passam a cobrir privilégios de funções.
## IMPORTANTE

A v1.9.0 não deve ser enviada diretamente ao GitHub antes das duas preparações abaixo.

## Etapa A — banco de dados

Primeiro execute o arquivo **somente leitura**:

`PRECHECK_V1.9.0.sql`

Se todas as tabelas/colunas/buckets obrigatórios aparecerem como `existe = true`, execute **somente**:

`supabase/migrations/20260814_corporate_hardening.sql`

A migration cria automaticamente um snapshot das policies, grants e visibilidade dos buckets antes de alterar a segurança. Se for necessário voltar, o pacote contém `ROLLBACK_SECURITY_V1.9.0.sql`.

Depois execute o arquivo de auditoria, que é somente leitura:

`SECURITY_AUDIT_V1.9.0.sql`

Confirme principalmente:

- RLS ativo nas tabelas listadas;
- buckets de fotos com `public = false`;
- existência de `profile_directory`;
- `pam_rows` maior que zero.

## Etapa B — bibliotecas locais

Na pasta extraída da v1.9.0, dê duplo clique em:

`PREPARAR_RELEASE.bat`

O script:

1. baixa Supabase JS 2.57.4;
2. baixa SheetJS CE 0.20.3;
3. salva ambos em `vendor/`;
4. calcula os hashes SHA-256;
5. verifica que não existe CDN em runtime;
6. verifica que a base operacional/PAM e a fotografia operacional não estão embarcados no frontend;
7. gera `Central_Manutencao_Homologacao_v1.9.0_READY.zip`.

Use o arquivo **READY** para o GitHub e, posteriormente, para os instaladores.

## Segurança de rollback

`ROLLBACK_SECURITY_V1.9.0.sql` restaura as policies/grants/buckets capturados antes do hardening. Ele deve ser usado somente se houver regressão e acompanhado da republicação da v1.8.2.

## O que NÃO fazer

- não rode migrations antigas novamente;
- não gere novas chaves VAPID;
- não altere Brevo/SMTP;
- não altere os Edge Function Secrets;
- não publique o pacote antes do `PREPARAR_RELEASE.bat` concluir com sucesso.

## Teste obrigatório antes do instalador

- login administrativo;
- login Equipe de Campo;
- criação/validação de conta por e-mail;
- abertura do PAM;
- Banco de Dados;
- criação e aprovação/devolução de relatório;
- fotos de ativo/perfil/manutenção;
- Exportar dados e Atualização em massa;
- Push;
- fechar e reabrir online;
- testar offline depois de uma sincronização online.

## Observação de segurança local

Na v1.9.0 os caches de dados locais são vinculados ao usuário autenticado. Em computador compartilhado, um usuário não deve visualizar nem sincronizar rascunhos/relatórios locais pendentes de outro perfil.
