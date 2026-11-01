# Runs inside Windows Sandbox when it starts (RankDB.wsb's LogonCommand): installs the WebView2
# runtime (the sandbox has none), starts the update feed and opens the folder with the installers.
# Its log goes to "RankDB logs" on the sandbox desktop (.sandbox/logs on the PC).
# See docs/SANDBOX-TESTING.md.

$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = Split-Path -Parent $scripts
$share = Join-Path $desktop "RankDB test"
$logs = Join-Path $desktop "RankDB logs"
Start-Transcript -Path (Join-Path $logs "start.log") -Force | Out-Null

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $scripts "serve.ps1"), "-Root", "`"$share`""
)

# The installer can't run from the read-only shared folder (it fails to create its temporary
# folder there), so it runs from a local copy.
# The sandbox has an empty EdgeWebView folder, so only the executable itself counts.
$runtime = "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application"
$installer = Join-Path $share "MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
$found = Get-ChildItem -Path $runtime -Recurse -Filter msedgewebview2.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($found) {
  Write-Host "WebView2 is already installed: $($found.FullName)"
} elseif (Test-Path -LiteralPath $installer) {
  $local = Join-Path $env:TEMP "MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
  Copy-Item -LiteralPath $installer -Destination $local -Force
  Write-Host "Installing the WebView2 runtime..."
  $process = Start-Process -FilePath $local -ArgumentList "/silent", "/install" -Wait -PassThru
  Write-Host "WebView2 installer exit code: $($process.ExitCode)"
  $exe = Get-ChildItem -Path $runtime -Recurse -Filter msedgewebview2.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  Write-Host "WebView2 runtime: $(if ($exe) { $exe.FullName } else { 'NOT FOUND' })"
}

# The sandbox borrows the PC's WebView2 files but not its registration, so apps report "Could not
# find the WebView2 Runtime". WebView2's own override variable points them at the files directly.
$key = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
Write-Host "WebView2 registration: $((Get-ItemProperty -Path $key -Name pv -ErrorAction SilentlyContinue).pv)"
$exe = Get-ChildItem -Path $runtime -Recurse -Filter msedgewebview2.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) {
  [Environment]::SetEnvironmentVariable("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", $exe.DirectoryName, "Machine")
  Write-Host "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = $($exe.DirectoryName)"
}

Start-Process explorer.exe -ArgumentList "`"$share`""
Stop-Transcript | Out-Null
