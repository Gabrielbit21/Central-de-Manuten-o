# Changelog

## v0.9.2 — Refinamento da tela de login

- Logo da Energisa da autenticação convertida para recurso embutido em Base64 dentro do HTML.
- Eliminada a dependência do arquivo externo `logo-energisa-color.png` na tela de login.
- Removida a mensagem visual sobre encerramento diário da sessão.
- Logout automático diário permanece ativo sem alteração de comportamento.
- APP_VERSION atualizado para 0.9.2.

## v0.9.1 — Autocadastro e sessão diária

- Autocadastro pela tela **Solicitar acesso**.
- Usuário escolhe o perfil solicitado: Equipe de Campo ou Administrativo.
- Toda conta criada por autocadastro nasce como **Pendente** e sem acesso aos dados do aplicativo.
- Painel administrativo com filas Pendentes, Ativos, Desativados e Rejeitados.
- Administrador aprova exatamente o perfil escolhido no autocadastro; alterações posteriores continuam disponíveis na edição administrativa.
- Administrador pode rejeitar solicitações.
- RLS reforçada para impedir usuários pendentes/inativos de consultar ou gravar dados do aplicativo.
- Bloqueio de alteração direta do próprio `role`/`active` em `profiles`.
- Logout automático na virada de cada dia, no fuso America/Sao_Paulo.
- Verificação ao abrir, voltar do segundo plano e durante o uso.
- Rascunho de manutenção preservado antes do logout diário.
- APP_VERSION atualizado para 0.9.1.
