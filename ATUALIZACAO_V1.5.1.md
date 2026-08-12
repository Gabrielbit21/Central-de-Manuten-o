# Central de Manutenção SE — atualização v1.5.1

## Objetivo
Patch de homologação para o fluxo de confirmação de e-mail por OTP.

## Correção
A v1.5.0 limitava o campo do código a exatamente 6 dígitos. A v1.5.1 não assume comprimento fixo: recebe o código numérico enviado pelo Supabase Auth e deixa a validação final para o próprio serviço de autenticação.

## Para quem já corrigiu `handle_new_user()` manualmente
Não execute SQL novamente. A migration nova foi incluída no pacote apenas para manter o histórico do banco consistente em futuras instalações/reconstruções.

## Atualização do ambiente atual
1. Suba todo o conteúdo da v1.5.1 para a raiz do mesmo repositório GitHub, substituindo a v1.5.0.
2. Aguarde o GitHub Pages publicar.
3. No navegador use `Ctrl + F5`.
4. Em PWA, feche completamente e abra novamente.
5. Repita a criação da conta e informe o código numérico recebido por e-mail.

Não é necessário republicar Edge Functions, alterar SMTP/Brevo, VAPID ou Secrets.
