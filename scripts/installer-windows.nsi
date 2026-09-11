; OpenFaceID Windows NSIS Installer Script
; Produces OpenFaceID-Setup-0.2.0-rc.1.exe

!define PRODUCT_NAME "OpenFaceID"
!define PRODUCT_VERSION "0.2.0-rc.1"
!define PRODUCT_PUBLISHER "Jayant Olhyan / OpenFaceID Community"
!define PRODUCT_WEB_SITE "https://github.com/JayantOlhyan/OpenFaceID"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\OpenFaceID.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

SetCompressor /SOLID lzma
RequestExecutionLevel admin

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist\OpenFaceID-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\OpenFaceID"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  
  ; Core files
  File /r "..\dist\windows\*.*"
  
  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\OpenFaceID"
  CreateShortCut "$SMPROGRAMS\OpenFaceID\OpenFaceID.lnk" "$INSTDIR\OpenFaceID.cmd" "" "$INSTDIR\OpenFaceID.cmd" 0
  CreateShortCut "$SMPROGRAMS\OpenFaceID\Uninstall OpenFaceID.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\OpenFaceID.lnk" "$INSTDIR\OpenFaceID.cmd" "" "$INSTDIR\OpenFaceID.cmd" 0

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Register in Windows Add/Remove Programs
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
SectionEnd

Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\OpenFaceID.lnk"
  Delete "$SMPROGRAMS\OpenFaceID\OpenFaceID.lnk"
  Delete "$SMPROGRAMS\OpenFaceID\Uninstall OpenFaceID.lnk"
  RMDir "$SMPROGRAMS\OpenFaceID"

  ; Clean installation directory
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\OpenFaceID.cmd"
  Delete "$INSTDIR\register-autostart.reg"
  RMDir /r "$INSTDIR"

  ; Remove registry keys
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "OpenFaceID"
SectionEnd
