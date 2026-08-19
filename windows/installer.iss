#define MyAppName "Central de Manutenção SE"
#ifndef MyAppVersion
  #error MyAppVersion deve ser informado pelo processo de build
#endif
#define MyAppExeName "CentralManutencaoSE.exe"

[Setup]
AppId={{4F2DDA4C-449C-493D-A7F1-94B7842EAA14}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Central de Manutenção SE
VersionInfoVersion={#MyAppVersion}
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
; Listado primeiro por eficiência com SolidCompression. O bootstrapper só é extraído pelo código se o Runtime estiver ausente.
Source: "stage\runtime\MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy noencryption
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
  Key := 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

  if RegQueryStringValue(HKLM32, Key, 'pv', Version) and RuntimeVersionValid(Version) then
  begin
    Result := True;
    exit;
  end;

  if RegQueryStringValue(HKCU, Key, 'pv', Version) and RuntimeVersionValid(Version) then
  begin
    Result := True;
    exit;
  end;
end;

function InstallWebView2Runtime(): String;
var
  InstallerPath: String;
  ResultCode: Integer;
begin
  Result := '';
  if WebView2RuntimeInstalled() then
    exit;

  try
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
  except
    Log('Falha ao extrair WebView2 bootstrapper: ' + GetExceptionMessage);
    Result := 'Não foi possível preparar o Microsoft WebView2 Runtime.';
    exit;
  end;

  InstallerPath := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  Log('Instalando Microsoft WebView2 Runtime...');

  if not Exec(InstallerPath, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('Falha ao iniciar WebView2 bootstrapper. Código: ' + IntToStr(ResultCode) + ' - ' + SysErrorMessage(ResultCode));
    Result := 'Não foi possível iniciar a instalação do Microsoft WebView2 Runtime.';
    exit;
  end;

  if ResultCode <> 0 then
  begin
    Log('WebView2 bootstrapper retornou código ' + IntToStr(ResultCode));
    Result := 'A instalação do Microsoft WebView2 Runtime falhou (código ' + IntToStr(ResultCode) + ').';
    exit;
  end;

  if not WebView2RuntimeInstalled() then
  begin
    Result := 'O Microsoft WebView2 Runtime não foi detectado após a instalação.';
    exit;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  NeedsRestart := False;
  Result := InstallWebView2Runtime();
end;
