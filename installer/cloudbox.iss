; Inno Setup script — builds CloudBox-Setup.exe (the laptop installer).
; Build with:  iscc installer\cloudbox.iss   (after staging files into installer\dist\)
; See installer\README.md for the full build steps.

#define MyAppName "CloudBox"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "VEER-TARGARYEN"
#define MyAppURL "https://github.com/VEER-TARGARYEN/cloudbox"

[Setup]
AppId={{B7E3F2A1-9C4D-4E5A-8B6C-C10UDB0X0001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\CloudBox
DefaultGroupName=CloudBox
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=CloudBox-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "dist\cloudbox.exe";       DestDir: "{app}"; Flags: ignoreversion
Source: "dist\cloudflared.exe";    DestDir: "{app}"; Flags: ignoreversion
Source: "dist\Start-CloudBox.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\README.txt";         DestDir: "{app}"; Flags: ignoreversion isreadme

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[Icons]
Name: "{group}\Start CloudBox"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Start-CloudBox.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\cloudbox.exe"
Name: "{group}\Uninstall CloudBox"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Start CloudBox"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Start-CloudBox.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\cloudbox.exe"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Start-CloudBox.ps1"""; Description: "Start CloudBox now"; Flags: postinstall nowait skipifsilent shellexec
