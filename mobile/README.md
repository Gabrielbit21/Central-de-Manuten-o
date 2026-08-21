# Central de Manutenção SE — Android

Camada Android nativa baseada em Capacitor 8.5.0.

## Build local

Requisitos:

- Node.js 22+
- Java/JDK 21
- Android Studio / Android SDK

Na pasta `mobile`:

```bash
npm install
npm run web:prepare
npx cap add android
node scripts/configure-android.mjs
java -Djava.awt.headless=true scripts/GenerateAndroidIcons.java ../assets/icons/app-icon-source.png android/app/src/main/res
cd android
./gradlew assembleDebug
```

`configure-android.mjs` aplica ao projeto Android gerado:

- `versionName` igual a `version.json`;
- `versionCode` monotônico derivado do SemVer;
- validação do `applicationId` e do nome oficial do aplicativo.

`GenerateAndroidIcons.java` gera os ícones Android legados e adaptativos a partir de `assets/icons/app-icon-source.png`, sem depender de ferramentas gráficas externas.

## Release oficial assinada

O workflow `.github/workflows/publicar-android.yml` gera um APK `release`, executa `zipalign`, assina com a chave privada estável do projeto, valida a assinatura com `apksigner` e publica uma release imutável com a tag `android-native-vX.Y.Z`.

Secrets exigidos no GitHub Actions:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

A chave de assinatura deve ser preservada permanentemente. Perder ou trocar essa chave impede atualizar uma instalação Android oficial existente com o mesmo `applicationId`.

### Migração a partir dos APKs de teste

Os APKs `debug` anteriores podem ter sido assinados com outra chave. Se o Android recusar a instalação oficial por conflito de assinatura, sincronize ou exporte qualquer dado local pendente, desinstale a versão de teste uma única vez e instale o APK oficial. Depois disso, futuras releases oficiais poderão ser instaladas por cima da anterior, desde que usem a mesma chave de assinatura.
