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
if (!mediaCoreText.includes('CENTRAL_MEDIA_CORE_V2')) {
  throw new Error('media-core.js não contém a assinatura CENTRAL_MEDIA_CORE_V2.');
}
new Function(mediaCoreText);

const nativeBridgeSource = join(mobileDir, 'native', 'native-bridge.js');
if (!existsSync(nativeBridgeSource)) throw new Error(`Bridge nativa não encontrada: ${nativeBridgeSource}`);
const nativeBridgeText = readFileSync(nativeBridgeSource, 'utf8');
if (!nativeBridgeText.includes('CENTRAL_NATIVE_BRIDGE_MEDIA_V3')) {
  throw new Error('native-bridge.js não contém a assinatura CENTRAL_NATIVE_BRIDGE_MEDIA_V3.');
}
if (nativeBridgeText.includes('installNativeImageInputBridge')) {
  throw new Error('native-bridge.js ainda contém interceptação global de input de imagem.');
}

buildSync({
  entryPoints: [nativeBridgeSource],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome120'],
  outfile: join(webDir, 'mobile-native.js'),
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});

const indexPath = join(webDir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const mediaCoreTag = '<script src="./assets/js/media-core.js"></script>';
const mobileCssTag = '<link rel="stylesheet" href="./mobile-overrides.css">';
const mobileJsTag = '<script src="./mobile-native.js"></script>';

if (!html.includes(mediaCoreTag)) {
  const appTag = '<script src="./app.js"></script>';
  if (!html.includes(appTag)) throw new Error('index.html não contém a referência esperada a app.js');
  html = html.replace(appTag, `${appTag}\n${mediaCoreTag}`);
}

if (!html.includes(mobileCssTag)) {
  if (!html.includes('</head>')) throw new Error('Não foi possível localizar </head> no index.html');
  html = html.replace('</head>', `${mobileCssTag}\n</head>`);
}

if (!html.includes(mobileJsTag)) {
  if (!html.includes('</body>')) throw new Error('Não foi possível localizar </body> no index.html');
  html = html.replace('</body>', `${mobileJsTag}\n</body>`);
}

writeFileSync(indexPath, html, 'utf8');
console.log(`Web bundle preparado em: ${webDir}`);
