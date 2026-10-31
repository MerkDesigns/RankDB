# Runs inside Windows Sandbox when it starts (RankDB.wsb's LogonCommand): starts the update feed
# and opens the folder with the installers. See docs/SANDBOX-TESTING.md.

$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
$share = Join-Path (Split-Path -Parent $scripts) "RankDB test"

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scripts "serve.ps1"), "-Root", "`"$share`""
)
Start-Process explorer.exe -ArgumentList "`"$share`""
