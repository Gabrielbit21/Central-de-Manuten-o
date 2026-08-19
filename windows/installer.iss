#define MyAppName "Central de Manutenção SE"

; A versão vem da variável de ambiente APP_VERSION definida pelo GitHub Actions.
; Se o ISCC também tiver recebido /DMyAppVersion, descartamos essa definição
; para evitar aspas/caracteres sendo incorporados ao VersionInfoVersion.
#ifdef MyAppVersion
  #undef MyAppVersion
#endif

#define MyAppVersion GetEnv("APP_VERSION")

#if MyAppVersion == ""
  #error APP_VERSION deve ser informado pelo processo de build
#endif

#define MyAppExeName "CentralManutencaoSE.exe"

[Setup]
AppId={{4F2DDA4C-449C-493D-A7F1-94B7842EAA14}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Central de Manutenção SE

; Inno Setup aceita versões com até 4 componentes.
; Ex.: 1.9.0 é válido e internamente equivale a 1.9.0.0.
VersionInfoVersion={#MyAppVersion}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoProductName={#MyAppName}
VersionInfoDescription=Instalador da Central de Manutenção SE

DefaultDirName={localappdata}\Programs\CentralManutencaoSE
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

SetupIconFile=..\assets\icons\central-manutencao.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}

OutputDir=stage\out
OutputBaseFilename=Central_Manutencao_SE_Setup_v{#MyAppVersion}_Native

Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

CloseApplications=yes
RestartApplications=no

[Files]
; Bootstrapper do WebView2 fica embutido no instalador, mas só será
; extraído se o Runtime não estiver instalado.
Source: "stage\runtime\MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy noencryption

; Aplicativo Windows e todos os arquivos da interface embarcada.
Source: "stage\package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\CentralManutencaoSE"

[Code]

function RuntimeVersionValid(const Version: String): Boolean;
begin
  Result := (Version <> '') and (Version <> '0.0.0.0');
end;


function WebView2RuntimeInstalled(): Boolean;
var
  Version: String;
  Key: String;
begin
  Result := False;

  Key :=
    'SOFTWARE\Microsoft\EdgeUpdate\Clients\' +
    '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

  { Instalação por máquina }
  if RegQueryStringValue(HKLM32, Key, 'pv', Version) then
  begin
    if RuntimeVersionValid(Version) then
    begin
      Log('Microsoft WebView2 Runtime encontrado em HKLM. Versão: ' + Version);
      Result := True;
      Exit;
    end;
  end;

  { Instalação por usuário }
  if RegQueryStringValue(HKCU, Key, 'pv', Version) then
  begin
    if RuntimeVersionValid(Version) then
    begin
      Log('Microsoft WebView2 Runtime encontrado em HKCU. Versão: ' + Version);
      Result := True;
      Exit;
    end;
  end;
end;


function InstallWebView2Runtime(): String;
var
  InstallerPath: String;
  ResultCode: Integer;
begin
  Result := '';

  if WebView2RuntimeInstalled() then
  begin
    Log('Microsoft WebView2 Runtime já está instalado.');
    Exit;
  end;

  Log('Microsoft WebView2 Runtime não encontrado. Preparando bootstrapper.');

  try
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
  except
    Log(
      'Falha ao extrair WebView2 bootstrapper: ' +
      GetExceptionMessage
    );
    Result :=
      'Não foi possível preparar o Microsoft WebView2 Runtime.';
    Exit;
  end;

  InstallerPath :=
    ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');

  if not FileExists(InstallerPath) then
  begin
    Log(
      'Bootstrapper WebView2 não encontrado após extração: ' +
      InstallerPath
    );
    Result :=
      'O instalador do Microsoft WebView2 Runtime não foi encontrado.';
    Exit;
  end;

  Log('Instalando Microsoft WebView2 Runtime...');

  ResultCode := -1;

  if not Exec(
    InstallerPath,
    '/silent /install',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) then
  begin
    Log(
      'Falha ao iniciar WebView2 bootstrapper. Código: ' +
      IntToStr(ResultCode) +
      ' - ' +
      SysErrorMessage(ResultCode)
    );

    Result :=
      'Não foi possível iniciar a instalação do Microsoft WebView2 Runtime.';
    Exit;
  end;

  if ResultCode <> 0 then
  begin
    Log(
      'WebView2 bootstrapper retornou código ' +
      IntToStr(ResultCode)
    );

    Result :=
      'A instalação do Microsoft WebView2 Runtime falhou (código ' +
      IntToStr(ResultCode) +
      ').';
    Exit;
  end;

  if not WebView2RuntimeInstalled() then
  begin
    Log(
      'Bootstrapper WebView2 terminou sem erro, mas o Runtime não foi detectado.'
    );

    Result :=
      'O Microsoft WebView2 Runtime não foi detectado após a instalação.';
    Exit;
  end;

  Log('Microsoft WebView2 Runtime instalado e validado com sucesso.');
end;


function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  NeedsRestart := False;
  Result := InstallWebView2Runtime();
end;
