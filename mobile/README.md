# Central de Manutenção SE — Android

Camada Android nativa baseada em Capacitor 8.5.0.

## Objetivo desta etapa

Gerar um contêiner Android reproduzível para a aplicação web existente, preservando:

- a interface responsiva já usada no celular;
- o mesmo Supabase e os mesmos usuários;
- a lógica offline atual;
- a aplicação Windows/PWA sem alterações.

## Preparação local

Requisitos iniciais:

- Node.js 22+
- Java/JDK 21
- Android Studio / Android SDK

Na pasta `mobile`:

```bash
npm install
npm run android:add
npm run android:open
```

O script `web:prepare` copia para `mobile/www` apenas os arquivos necessários da aplicação web:
`index.html`, `app.js`, `manifest.webmanifest`, `sw.js`, `version.json`, `assets/` e `vendor/`.

## Observação importante

A primeira etapa apenas comprova que o aplicativo atual abre e funciona no contêiner Android.
Push nativo, integração refinada de câmera/arquivos, botão voltar e demais recursos nativos serão adicionados em etapas posteriores, após a validação do esqueleto.
