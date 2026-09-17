; OpenFaceID Windows Installer (Inno Setup Script)
; Packages daemon, models, UI, and native Credential Provider DLL

#define MyAppName "OpenFaceID"
#define MyAppVersion "0.2.1-rc.1"
#define MyAppPublisher "OpenFaceID Contributors"
#define MyAppURL "https://github.com/JayantOlhyan/OpenFaceID"
#define MyAppExeName "OpenFaceID.exe"
#define MyCLSID "{8E9A3471-968B-4B52-8724-4B9F5D88A112}"

[Setup]
AppId={{C6418E29-2E3F-4F9A-A376-880FD26B4D72}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\..\dist\windows
OutputBaseFilename=OpenFaceID-{#MyAppVersion}-x64-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Start OpenFaceID automatically with Windows"; GroupDescription: "Startup:"

[Files]
Source: "..\..\dist\windows\OpenFaceIDCredentialProvider.dll"; DestDir: "{sys}"; Flags: restartreplace uninsrestartdelete
Source: "..\..\models\*"; DestDir: "{app}\models"; Flags: ignoreversion recursesubdirs
Source: "..\..\apps\desktop\*"; DestDir: "{app}\apps\desktop"; Flags: ignoreversion recursesubdirs
Source: "..\..\packages\*"; DestDir: "{app}\packages"; Flags: ignoreversion recursesubdirs
Source: "..\..\package.json"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; COM InprocServer32 Registration
Root: HKLM; Subkey: "SOFTWARE\Classes\CLSID\{#MyCLSID}"; ValueType: string; ValueData: "OpenFaceID Credential Provider"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\Classes\CLSID\{#MyCLSID}\InprocServer32"; ValueType: string; ValueData: "{sys}\OpenFaceIDCredentialProvider.dll"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\Classes\CLSID\{#MyCLSID}\InprocServer32"; ValueType: string; ValueName: "ThreadingModel"; ValueData: "Apartment"

; Windows Credential Provider Registration
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\Credential Providers\{#MyCLSID}"; ValueType: string; ValueData: "OpenFaceIDCredentialProvider"; Flags: uninsdeletekey

; Autostart
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"" --daemon"; Tasks: autostart; Flags: uninsdeletevalue

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
