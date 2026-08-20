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

const rootDirectories = [
  'assets',
  'vendor',
];

const mobileFiles = [
  'mobile-overrides.css',
];

rmSync(webDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });

for (const file of rootFiles) {
  const source = join(repoRoot, file);
  if (!existsSync(source)) {
    throw new Error(`Arquivo obrigatório não encontrado: ${source}`);
  }
  cpSync(source, join(webDir, file));
}

for (const dir of rootDirectories) {
  const source = join(repoRoot, dir);
  if (!existsSync(source)) {
    throw new Error(`Diretório obrigatório não encontrado: ${source}`);
  }
  cpSync(source, join(webDir, dir), { recursive: true });
}

for (const file of mobileFiles) {
  const source = join(mobileDir, file);
  if (!existsSync(source)) {
    throw new Error(`Arquivo mobile obrigatório não encontrado: ${source}`);
  }
  cpSync(source, join(webDir, file));
}

/*
 * Injeta o CSS exclusivo do Android depois dos estilos existentes.
 * Assim a versão Windows/PWA continua usando os arquivos originais.
 */
const indexPath = join(webDir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const mobileCssTag = '<link rel="stylesheet" href="./mobile-overrides.css">';

if (!html.includes(mobileCssTag)) {
  if (!html.includes('</head>')) {
    throw new Error('Não foi possível localizar </head> no index.html');
  }
  html = html.replace('</head>', `${mobileCssTag}\n</head>`);
  writeFileSync(indexPath, html, 'utf8');
}

console.log(`Web bundle preparado em: ${webDir}`);
