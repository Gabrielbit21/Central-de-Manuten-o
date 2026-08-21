import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '..');
const repoRoot = resolve(mobileDir, '..');
const androidDir = resolve(mobileDir, 'android');
const gradlePath = resolve(androidDir, 'app', 'build.gradle');
const capacitorConfigPath = resolve(mobileDir, 'capacitor.config.json');
const versionPath = resolve(repoRoot, 'version.json');

for (const required of [gradlePath, capacitorConfigPath, versionPath]) {
  if (!existsSync(required)) throw new Error(`Arquivo obrigatório não encontrado: ${required}`);
}

const versionManifest = JSON.parse(readFileSync(versionPath, 'utf8'));
const versionName = String(versionManifest.build || '').trim();
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(versionName);
if (!match) throw new Error(`Versão Android inválida em version.json: ${versionName}`);

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]);
if ([major, minor, patch].some((value) => !Number.isSafeInteger(value) || value < 0 || value > 999)) {
  throw new Error(`Cada componente da versão deve ficar entre 0 e 999: ${versionName}`);
}

// Mantém ordenação monotônica para atualizações Android: Mmmppp.
const versionCode = major * 1_000_000 + minor * 1_000 + patch;
if (versionCode <= 0 || versionCode > 2_100_000_000) {
  throw new Error(`versionCode Android fora do intervalo aceito: ${versionCode}`);
}

const capacitorConfig = JSON.parse(readFileSync(capacitorConfigPath, 'utf8'));
if (capacitorConfig.appId !== 'io.github.gabrielbit21.centralmanutencaose') {
  throw new Error(`appId Android inesperado: ${capacitorConfig.appId}`);
}
if (capacitorConfig.appName !== 'Central de Manutenção SE') {
  throw new Error(`appName Android inesperado: ${capacitorConfig.appName}`);
}

let gradle = readFileSync(gradlePath, 'utf8');
const original = gradle;
let versionCodeReplacements = 0;
let versionNameReplacements = 0;

gradle = gradle.replace(/(^\s*versionCode\s+)\d+\s*$/m, (_full, prefix) => {
  versionCodeReplacements += 1;
  return `${prefix}${versionCode}`;
});

gradle = gradle.replace(/(^\s*versionName\s+)["'][^"']*["']\s*$/m, (_full, prefix) => {
  versionNameReplacements += 1;
  return `${prefix}"${versionName}"`;
});

if (versionCodeReplacements !== 1 || versionNameReplacements !== 1) {
  throw new Error(
    `Não foi possível configurar versão no app/build.gradle ` +
    `(versionCode=${versionCodeReplacements}, versionName=${versionNameReplacements}).`,
  );
}

if (gradle === original) throw new Error('build.gradle não foi alterado.');
writeFileSync(gradlePath, gradle, 'utf8');

console.log(`Android configurado: ${capacitorConfig.appName}`);
console.log(`applicationId: ${capacitorConfig.appId}`);
console.log(`versionName: ${versionName}`);
console.log(`versionCode: ${versionCode}`);
