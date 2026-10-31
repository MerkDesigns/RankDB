# The sandbox's update feed: serves the test installers and latest.json on http://127.0.0.1:8765/,
# where the sandbox builds' updater looks. Started by start.ps1; leave its window open.
# Add -Off to answer 404 instead (for testing "no update" / an unreachable feed).

param(
  [Parameter(Mandatory = $true)][string]$Root,
  [int]$Port = 8765,
  [switch]$Off
)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "RankDB update feed: http://127.0.0.1:$Port/ (serving $Root). Close this window to stop it."

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $name = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
  $path = Join-Path $Root $name
  $response = $context.Response
  # Only plain files directly in the folder; nothing outside it.
  if (-not $Off -and $name -and $name -notmatch '[\\/]|\.\.' -and (Test-Path -LiteralPath $path -PathType Leaf)) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $response.ContentType = if ($name.EndsWith(".json")) { "application/json" } else { "application/octet-stream" }
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host "200 $name"
  } else {
    $response.StatusCode = 404
    Write-Host "404 $name"
  }
  $response.Close()
}
