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

const mediaCoreSource = join(repoRoot, 'assets', 'js', 'media-core.js');
if (!existsSync(mediaCoreSource)) {
  throw new Error(`Camada compartilhada de mídia não encontrada: ${mediaCoreSource}`);
}
const mediaCoreText = readFileSync(mediaCoreSource, 'utf8');
if (!mediaCoreText.includes('CENTRAL_MEDIA_CORE_V4') || !mediaCoreText.includes('FINAL_UX_V4_1')) {
  throw new Error('media-core.js não contém as assinaturas CENTRAL_MEDIA_CORE_V4 + FINAL_UX_V4_1.');
}
new Function(mediaCoreText);

const v205PrebootSource = join(repoRoot, 'assets', 'js', 'v205-preboot.js');
const v205Source = join(repoRoot, 'assets', 'js', 'v205.js');
const v205CssSource = join(repoRoot, 'assets', 'css', 'v205.css');
const v206Source = join(repoRoot, 'assets', 'js', 'v206.js');
const v206CssSource = join(repoRoot, 'assets', 'css', 'v206.css');
const v207Source = join(repoRoot, 'assets', 'js', 'v207.js');
const v207CssSource = join(repoRoot, 'assets', 'css', 'v207.css');
for (const source of [v205PrebootSource, v205Source, v205CssSource, v206Source, v206CssSource, v207Source, v207CssSource]) {
  if (!existsSync(source)) throw new Error(`Arquivo de camada funcional obrigatório não encontrado: ${source}`);
}
const v205PrebootText = readFileSync(v205PrebootSource, 'utf8');
const v205Text = readFileSync(v205Source, 'utf8');
const v205CssText = readFileSync(v205CssSource, 'utf8');
const v206Text = readFileSync(v206Source, 'utf8');
const v206CssText = readFileSync(v206CssSource, 'utf8');
const v207Text = readFileSync(v207Source, 'utf8');
const v207CssText = readFileSync(v207CssSource, 'utf8');
if (!v205Text.includes("const V205_VERSION='2.0.6'")) throw new Error('v205.js base esperada: 2.0.6.');
if (!v206Text.includes("const V206_VERSION = '2.0.6'")) throw new Error('v206.js base esperada: 2.0.6.');
if (!v207Text.includes("const V207_VERSION = '2.0.7'")) throw new Error('v207.js não identifica a versão 2.0.7.');
new Function(v205PrebootText);
new Function(v205Text);
new Function(v206Text);
new Function(v207Text);

const nativeBridgeSource = join(mobileDir, 'native', 'native-bridge.js');
if (!existsSync(nativeBridgeSource)) throw new Error(`Bridge nativa não encontrada: ${nativeBridgeSource}`);
const nativeBridgeText = readFileSync(nativeBridgeSource, 'utf8');
if (!nativeBridgeText.includes('CENTRAL_NATIVE_BRIDGE_MEDIA_V5')) {
  throw new Error('native-bridge.js não contém a assinatura CENTRAL_NATIVE_BRIDGE_MEDIA_V5.');
}
if (nativeBridgeText.includes('installNativeImageInputBridge')) {
  throw new Error('native-bridge.js ainda contém interceptação global de input de imagem.');
}

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

const buildToken = createHash('sha256')
  .update(appText)
  .update(mediaCoreText)
  .update(v205PrebootText)
  .update(v205Text)
  .update(v205CssText)
  .update(v206Text)
  .update(v206CssText)
  .update(v207Text)
  .update(v207CssText)
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
const prebootTag = '<script src="./assets/js/v205-preboot.js"></script>';
const appTag = '<script src="./app.js"></script>';
const v205Tag = '<script src="./assets/js/v205.js"></script>';
const v206Tag = '<script src="./assets/js/v206.js"></script>';
const v207Tag = '<script src="./assets/js/v207.js"></script>';
const mediaCoreTag = '<script src="./assets/js/media-core.js"></script>';
const mobileCssTag = '<link rel="stylesheet" href="./mobile-overrides.css">';

html = html
  .replace(prebootTag, '')
  .replace(appTag, '')
  .replace(v205Tag, '')
  .replace(v206Tag, '')
  .replace(v207Tag, '')
  .replace(mediaCoreTag, '')
  .replace('<script src="./mobile-native.js"></script>', '');

if (!html.includes(mobileCssTag)) {
  if (!html.includes('</head>')) throw new Error('Não foi possível localizar </head> no index.html');
  html = html.replace('</head>', `${mobileCssTag}\n</head>`);
}

const nativeScripts = [
  `<script src="./${nativeBundleName}"></script>`,
  prebootTag,
  `<script src="./${nativeAppName}"></script>`,
  v205Tag,
  v206Tag,
  v207Tag,
  `<script src="./assets/js/${nativeMediaName}"></script>`,
].join('\n');

if (!html.includes('</body>')) throw new Error('Não foi possível localizar </body> no index.html');
html = html.replace('</body>', `${nativeScripts}\n</body>`);

writeFileSync(indexPath, html, 'utf8');
writeFileSync(join(webDir, 'android-build.json'), JSON.stringify({
  token: buildToken,
  appVersion: '2.0.7',
  v205: 'enabled',
  v206: 'enabled',
  v207: 'enabled',
  mediaCore: '4.1.0',
  nativeBridge: '5.0.0',
  serviceWorker: 'disabled-in-native',
}, null, 2), 'utf8');

console.log(`Web bundle Android preparado em: ${webDir}`);
console.log(`Android content token: ${buildToken}`);
