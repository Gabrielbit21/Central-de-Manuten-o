# Cadastro e verificação — v1.3.0

## Fluxo principal: e-mail OTP
- Aceita qualquer endereço de e-mail válido.
- Supabase Auth envia `{{ .Token }}` pelo SMTP customizado.
- O usuário digita o código numérico recebido e a conta é liberada como Equipe de Campo. O front-end não fixa uma quantidade exata de dígitos; a validação final é feita pelo Supabase Auth.

## Contingência: código de convite
- Um administrador abre **Usuários e notificações → Gerar convite**.
- O código tem 16 caracteres, é de uso único e expira no prazo escolhido.
- O usuário escolhe **Usar código de convite** na tela Criar conta.
- Esse fluxo confirma/cria a conta por uma Edge Function segura e sempre concede apenas perfil de Equipe de Campo.
- O código completo é mostrado somente na criação; no banco fica apenas SHA-256 + os quatro últimos caracteres.

Perfis administrativos continuam sendo criados/promovidos somente por administradores autenticados.
