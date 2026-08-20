import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '..');
const repoRoot = resolve(mobileDir, '..');
const webDir = join(mobileDir, 'www');

const files = [
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'version.json',
];

const directories = [
  'assets',
  'vendor',
];

rmSync(webDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });

for (const file of files) {
  const source = join(repoRoot, file);
  if (!existsSync(source)) {
    throw new Error(`Arquivo obrigatório não encontrado: ${source}`);
  }
  cpSync(source, join(webDir, file));
}

for (const dir of directories) {
  const source = join(repoRoot, dir);
  if (!existsSync(source)) {
    throw new Error(`Diretório obrigatório não encontrado: ${source}`);
  }
  cpSync(source, join(webDir, dir), { recursive: true });
}

console.log(`Web bundle preparado em: ${webDir}`);
