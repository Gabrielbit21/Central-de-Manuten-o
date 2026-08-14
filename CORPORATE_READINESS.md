# Central de Manutenção SE v1.9.0 — Corporate Ready

> **Revisão de segurança R2 (14/08/2026):** PRECHECK confirmou as travas administrativas em `public.is_admin()` e `apply_asset_update_internal()`. O helper interno de atualização de ativos é explicitamente bloqueado para `anon` e `authenticated`, e a auditoria/rollback passam a cobrir privilégios de funções.
## Objetivo desta versão

A v1.9.0 é uma versão de hardening. Ela não altera o fluxo visual consolidado na v1.8.2; o foco é reduzir exposição de dados e dependências externas antes da criação do instalador Windows e do APK Android.

## Mudanças de segurança

### 1. Dados operacionais removidos do frontend estático

O frontend estático não leva mais o cadastro completo de subestações, ativos, histórico de manutenção nem o seed do PAM. A fotografia operacional usada no banner também foi removida e substituída por um fundo gráfico neutro.

O fluxo agora é:

1. abrir a aplicação;
2. autenticar no Supabase;
3. validar o perfil;
4. carregar a base autorizada;
5. armazenar cache local apenas para o usuário autenticado daquele dispositivo.

O cache operacional é separado por usuário e removido quando a sessão é encerrada explicitamente ou pela política diária de sessão.

### 2. PAM passa a depender da base em nuvem

A migration `20260814_corporate_hardening.sql` garante que os itens do PAM existentes na versão anterior sejam inseridos no Supabase caso ainda estejam ausentes. Ela não sobrescreve registros já existentes.

### 3. Bibliotecas JavaScript locais

A execução da v1.9.0 usa somente:

- `vendor/supabase-js-2.57.4.min.js`
- `vendor/xlsx-0.20.3.full.min.js`

Não existe fallback de CDN em runtime.

Execute `PREPARAR_RELEASE.bat` uma única vez antes da publicação. O script baixa as versões fixadas, valida o conteúdo básico, calcula SHA-256 e gera o pacote `v1.9.0_READY`.

### 4. Content Security Policy

O frontend possui CSP restringindo recursos à própria aplicação e ao projeto Supabase:

- JavaScript executável apenas a partir de arquivos locais (`script-src 'self'`);
- estilos, imagens e workers locais;
- HTTPS/WSS somente para o projeto Supabase configurado;
- `object-src 'none'`;
- `base-uri 'self'`;
- `form-action 'self'`.

O JavaScript principal foi separado em `app.js`, removendo `unsafe-inline` de `script-src`. O CSS ainda usa estilos inline/atributos dinâmicos e, por isso, `style-src` mantém `unsafe-inline` nesta versão.

### 5. RLS e privilégio mínimo

A migration v1.9.0:

- restringe `profiles` ao próprio usuário;
- cria `profile_directory` somente com campos seguros usados pela interface;
- aplica leitura autenticada ao catálogo operacional;
- limita INSERT de relatórios e filhos ao próprio autor;
- limita operações de ativos ao próprio autor;
- limita auditoria de ativos/importações a administradores;
- mantém alterações sensíveis por RPC/Edge Function;
- torna os buckets de fotos privados e aplica policies explícitas.

## Dados locais

O modo offline continua disponível depois de pelo menos uma sincronização online naquele dispositivo e usuário.

A v1.9.0 não apaga relatórios locais pendentes, fotos de manutenção ou filas de sincronização ao sair da conta, para evitar perda de trabalho de campo. O snapshot vindo da nuvem e a foto do perfil em cache são removidos no logout. Rascunhos, relatórios locais, fila de sincronização e operações locais são filtrados pelo usuário autenticado para evitar mistura de dados quando um computador é compartilhado.

## Endpoints de runtime

O aplicativo web/instalado precisa de acesso ao projeto Supabase:

- `https://szshskfyocsumvmqwuem.supabase.co`
- `wss://szshskfyocsumvmqwuem.supabase.co` (quando requerido pelo cliente/plataforma)

O envio de e-mail pelo Brevo é servidor-servidor via Supabase e não exige acesso direto do cliente ao Brevo.

Notificações Web Push dependem também do serviço de Push do navegador/sistema operacional. Caso a política corporativa bloqueie Push, as demais funções da Central continuam operacionais.

## Dependências de build, não de runtime

Somente ao executar `PREPARAR_RELEASE.bat`:

- `cdn.jsdelivr.net` — aquisição fixada do Supabase JS 2.57.4;
- `cdn.sheetjs.com` — aquisição fixada do SheetJS CE 0.20.3.

Depois do preparo, os arquivos ficam locais e os domínios acima não são necessários para executar a aplicação.

## Antes de gerar EXE / APK

1. Executar `PRECHECK_V1.9.0.sql` (somente leitura).
2. Executar `20260814_corporate_hardening.sql` no Supabase; a migration salva automaticamente a configuração de segurança anterior.
3. Executar `SECURITY_AUDIT_V1.9.0.sql` e revisar o resultado.
4. Executar `PREPARAR_RELEASE.bat`.
5. Publicar/testar a v1.9.0 READY no GitHub Pages.
6. Validar login, PAM, relatório, fotos, exportação Excel, Push e offline.
7. Somente depois congelar os arquivos para empacotamento Windows/Android.

Se houver regressão de segurança/acesso, `ROLLBACK_SECURITY_V1.9.0.sql` restaura policies, grants e flags dos buckets capturados antes do hardening.

## Windows corporativo

O instalador final deverá:

- usar WebView2;
- embarcar os arquivos locais da v1.9.0 READY;
- não depender do GitHub Pages para executar;
- ter identidade de aplicativo consistente;
- preferencialmente receber assinatura de código para distribuição corporativa.

## Android

O APK final deverá:

- usar o mesmo frontend local;
- usar a mesma base Supabase;
- ser compilado em modo release;
- ser assinado com chave de release preservada para futuras atualizações.
