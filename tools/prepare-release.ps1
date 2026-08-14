$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ToolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ToolsDir
$Vendor = Join-Path $Root 'vendor'
New-Item -ItemType Directory -Force -Path $Vendor | Out-Null

$deps = @(
  @{
    Name='Supabase JS 2.57.4';
    Url='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';
    File='supabase-js-2.57.4.min.js';
    MinBytes=100000;
    Marker='createClient'
  },
  @{
    Name='SheetJS CE 0.20.3';
    Url='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    File='xlsx-0.20.3.full.min.js';
    MinBytes=500000;
    Marker='XLSX';
    ExpectedMd5='6b3130af1ceadf07caa0ec08af7addff'
  }
)

Write-Host ''
Write-Host 'Central de Manutencao SE v1.9.0 - preparacao Corporate Ready' -ForegroundColor Cyan
Write-Host 'As dependencias sao baixadas uma unica vez e ficam locais no pacote final.'
Write-Host ''

foreach ($dep in $deps) {
  $target = Join-Path $Vendor $dep.File
  Write-Host ("Baixando {0}..." -f $dep.Name)
  Invoke-WebRequest -UseBasicParsing -Uri $dep.Url -OutFile $target
  $item = Get-Item $target
  if ($item.Length -lt $dep.MinBytes) {
    throw "Arquivo $($dep.File) ficou menor que o esperado ($($item.Length) bytes)."
  }
  $probe = Get-Content -Raw -Encoding UTF8 $target
  if ($probe -notmatch [regex]::Escape($dep.Marker)) {
    throw "Arquivo $($dep.File) nao contem a assinatura esperada '$($dep.Marker)'."
  }
  if ($dep.ExpectedMd5) {
    $md5 = (Get-FileHash -Algorithm MD5 $target).Hash.ToLowerInvariant()
    if ($md5 -ne $dep.ExpectedMd5) { throw "Checksum MD5 oficial inesperado em $($dep.File): $md5" }
  }
  Write-Host ("OK: {0:N0} bytes" -f $item.Length) -ForegroundColor Green
}

$vendorHashFile = Join-Path $Vendor 'THIRD_PARTY_SHA256SUMS.txt'
$vendorLines = foreach ($dep in $deps) {
  $target = Join-Path $Vendor $dep.File
  $h = Get-FileHash -Algorithm SHA256 $target
  "{0}  {1}" -f $h.Hash.ToLowerInvariant(), $dep.File
}
$vendorLines | Set-Content -Encoding ASCII $vendorHashFile

# Hashes de todo o release, ignorando o arquivo de hashes antigo e ZIPs gerados.
$rootHashFile = Join-Path $Root 'SHA256SUMS.txt'
$files = Get-ChildItem -Path $Root -File -Recurse | Where-Object {
  $_.FullName -ne $rootHashFile -and $_.Extension -ne '.zip'
} | Sort-Object FullName
$rootLines = foreach ($file in $files) {
  $h = Get-FileHash -Algorithm SHA256 $file.FullName
  $relative = $file.FullName.Substring($Root.Length + 1).Replace('\','/')
  "{0}  {1}" -f $h.Hash.ToLowerInvariant(), $relative
}
$rootLines | Set-Content -Encoding ASCII $rootHashFile

# Verificacoes basicas de hardening.
$index = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'index.html')
if ($index -match 'cdn\.jsdelivr\.net|cdn\.sheetjs\.com') {
  throw 'index.html ainda contem referencia de runtime para CDN externo.'
}
if ($index -match 'const DATA=\{"substations":\[\{"id"') {
  throw 'index.html ainda parece conter a base operacional embarcada.'
}
if ($index -match 'PAM2026-0002') { throw 'index.html ainda parece conter o seed PAM embarcado.' }
$appJs = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'app.js')
if (($index + $appJs) -match 'data:image/webp;base64|PAM2026-0002|Além Paraíba|Lucas Trindade') { throw 'Frontend ainda contem marcador de dado/imagem operacional embarcado.' }
if ($index -match "script-src 'self' 'unsafe-inline'") { throw 'CSP de scripts ainda permite unsafe-inline.' }

$readyZip = Join-Path (Split-Path -Parent $Root) 'Central_Manutencao_Homologacao_v1.9.0_READY.zip'
if (Test-Path $readyZip) { Remove-Item $readyZip -Force }
Compress-Archive -Path (Join-Path $Root '*') -DestinationPath $readyZip -CompressionLevel Optimal

Write-Host ''
Write-Host 'PREPARACAO CONCLUIDA.' -ForegroundColor Green
Write-Host ("Hashes: {0}" -f $rootHashFile)
Write-Host ("Pacote pronto: {0}" -f $readyZip)
Write-Host ''
