import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '..');
const repoRoot = resolve(mobileDir, '..');
const webDir = join(mobileDir, 'www');

const rootFiles = [
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'version.json',
];

const rootDirectories = ['assets', 'vendor'];
const mobileFiles = ['mobile-overrides.css'];

rmSync(webDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });

for (const file of rootFiles) {
  const source = join(repoRoot, file);
  if (!existsSync(source)) throw new Error(`Arquivo obrigatório não encontrado: ${source}`);
  cpSync(source, join(webDir, file));
}

for (const dir of rootDirectories) {
  const source = join(repoRoot, dir);
  if (!existsSync(source)) throw new Error(`Diretório obrigatório não encontrado: ${source}`);
  cpSync(source, join(webDir, dir), { recursive: true });
}

for (const file of mobileFiles) {
  const source = join(mobileDir, file);
  if (!existsSync(source)) throw new Error(`Arquivo mobile obrigatório não encontrado: ${source}`);
  cpSync(source, join(webDir, file));
}

// A mesma camada de negócio é carregada em PWA, Windows e Android.
// A diferença de plataforma fica isolada no CentralNativeAndroid, sem
// interceptar input[type=file] nem concatenar patches ao app.js.
const mediaCoreSource = join(repoRoot, 'assets', 'js', 'media-core.js');
if (!existsSync(mediaCoreSource)) {
  throw new Error(`Camada compartilhada de mídia não encontrada: ${mediaCoreSource}`);
}
const mediaCoreText = readFileSync(mediaCoreSource, 'utf8');
if (!mediaCoreText.includes('CENTRAL_MEDIA_CORE_V3')) {
  throw new Error('media-core.js não contém a assinatura CENTRAL_MEDIA_CORE_V3.');
}
new Function(mediaCoreText);

const nativeBridgeSource = join(mobileDir, 'native', 'native-bridge.js');
if (!existsSync(nativeBridgeSource)) throw new Error(`Bridge nativa não encontrada: ${nativeBridgeSource}`);
const nativeBridgeText = readFileSync(nativeBridgeSource, 'utf8');
if (!nativeBridgeText.includes('CENTRAL_NATIVE_BRIDGE_MEDIA_V4')) {
  throw new Error('native-bridge.js não contém a assinatura CENTRAL_NATIVE_BRIDGE_MEDIA_V4.');
}
if (nativeBridgeText.includes('installNativeImageInputBridge')) {
  throw new Error('native-bridge.js ainda contém interceptação global de input de imagem.');
}

// O APK não deve registrar Service Worker: os assets já são embarcados localmente.
// Mantemos SW apenas em PWA; no Android ele causava cache persistente entre APKs.
const appPath = join(webDir, 'app.js');
let appText = readFileSync(appPath, 'utf8');
const swFunctionMarker = 'async function registerCentralServiceWorker(){';
if (!appText.includes(swFunctionMarker)) {
  throw new Error('app.js não contém registerCentralServiceWorker.');
}
appText = appText.replace(
  swFunctionMarker,
  `${swFunctionMarker}\n  if(globalThis.__CENTRAL_ANDROID_NATIVE__===true)return null;`,
);
writeFileSync(appPath, appText, 'utf8');

// Token de conteúdo: cada mudança funcional gera nomes novos dentro do APK.
// Mesmo que um WebView antigo ainda esteja temporariamente sob controle de um
// Service Worker legado, os novos nomes não existem no cache antigo.
const buildToken = createHash('sha256')
  .update(appText)
  .update(mediaCoreText)
  .update(nativeBridgeText)
  .digest('hex')
  .slice(0, 12);

const nativeAppName = `app-native-${buildToken}.js`;
const nativeMediaName = `media-core-native-${buildToken}.js`;
const nativeBundleName = `mobile-native-${buildToken}.js`;

writeFileSync(join(webDir, nativeAppName), appText, 'utf8');
writeFileSync(join(webDir, 'assets', 'js', nativeMediaName), mediaCoreText, 'utf8');

buildSync({
  entryPoints: [nativeBridgeSource],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome120'],
  outfile: join(webDir, nativeBundleName),
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});

const indexPath = join(webDir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const appTag = '<script src="./app.js"></script>';
const mediaCoreTag = '<script src="./assets/js/media-core.js"></script>';
const mobileCssTag = '<link rel="stylesheet" href="./mobile-overrides.css">';

// Remove scripts genéricos: no Android usamos nomes content-addressed.
html = html
  .replace(appTag, '')
  .replace(mediaCoreTag, '')
  .replace('<script src="./mobile-native.js"></script>', '');

if (!html.includes(mobileCssTag)) {
  if (!html.includes('</head>')) throw new Error('Não foi possível localizar </head> no index.html');
  html = html.replace('</head>', `${mobileCssTag}\n</head>`);
}

const nativeScripts = [
  `<script src="./${nativeBundleName}"></script>`,
  `<script src="./${nativeAppName}"></script>`,
  `<script src="./assets/js/${nativeMediaName}"></script>`,
].join('\n');

if (!html.includes('</body>')) throw new Error('Não foi possível localizar </body> no index.html');
html = html.replace('</body>', `${nativeScripts}\n</body>`);

writeFileSync(indexPath, html, 'utf8');
writeFileSync(join(webDir, 'android-build.json'), JSON.stringify({
  token: buildToken,
  mediaCore: '3.0.0',
  nativeBridge: '4.0.0',
  serviceWorker: 'disabled-in-native',
}, null, 2), 'utf8');

console.log(`Web bundle Android preparado em: ${webDir}`);
console.log(`Android content token: ${buildToken}`);
