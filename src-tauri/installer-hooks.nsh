; RankDB's additions to the NSIS installer Tauri generates (tauri.release.conf.json `installerHooks`).

; Backup files (.rankdb) show their own icon instead of the app's: Tauri's file association
; (`fileAssociations`, class RankDB.Backup) always points at the exe's icon, so it is repointed
; here, after the association was written. The icon is a bundled resource next to the exe.
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\RankDB.Backup\DefaultIcon" "" "$INSTDIR\backup-file.ico"
  !insertmacro UPDATEFILEASSOC
!macroend
