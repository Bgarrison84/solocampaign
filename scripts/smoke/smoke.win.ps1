# SoloCampaign Windows Smoke Test
# Run after: npm run build
# Usage: pwsh -File scripts/smoke/smoke.win.ps1
param(
  [string]$DistDir = "dist"
)

$ErrorActionPreference = "Stop"
$failed = 0

function Check($label, $condition) {
  if ($condition) {
    Write-Host "[PASS] $label" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $label" -ForegroundColor Red
    $script:failed++
  }
}

Write-Host "--- SoloCampaign Windows Smoke Test ---"

# 1. Build output exists
$exePath = Get-ChildItem -Path $DistDir -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
Check "NSIS installer .exe exists in dist/" ($null -ne $exePath)

# 2. Unpacked app binary exists (win-unpacked)
$unpackedExe = "$DistDir\win-unpacked\SoloCampaign.exe"
Check "win-unpacked\SoloCampaign.exe exists" (Test-Path $unpackedExe)

# 3. better-sqlite3 ASAR-unpacked .node file
$nodeFiles = Get-ChildItem -Path "$DistDir\win-unpacked\resources\app.asar.unpacked\node_modules\better-sqlite3" -Filter "*.node" -Recurse -ErrorAction SilentlyContinue
Check "better-sqlite3 .node file exists in asar.unpacked" ($nodeFiles.Count -gt 0)

# 4. Drizzle migration SQL accessible from resourcesPath
$migrationSql = "$DistDir\win-unpacked\resources\migrations\0000_absent_thunderball.sql"
Check "Drizzle migration SQL exists at resourcesPath\migrations\" (Test-Path $migrationSql)

# 5. Launch packaged app and wait for it to start (max 10s), then check process
if (Test-Path $unpackedExe) {
  $proc = Start-Process -FilePath $unpackedExe -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 6
  $running = !$proc.HasExited
  Check "Packaged app launched without immediate crash (running after 6s)" $running

  # 6. Single-instance lock: launch a second instance and it should exit within 3s
  if ($running) {
    $proc2 = Start-Process -FilePath $unpackedExe -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Check "Second instance exits quickly (single-instance lock)" $proc2.HasExited

    if (!$proc2.HasExited) { $proc2.Kill() }
  }

  # 7. DB file created in userData
  $userData = [System.Environment]::GetFolderPath("ApplicationData")
  $dbPath = "$userData\SoloCampaign\solocampaign.db"
  Start-Sleep -Seconds 2
  Check "solocampaign.db created in %APPDATA%\SoloCampaign\" (Test-Path $dbPath)

  # Cleanup
  if (!$proc.HasExited) { $proc.Kill() }
}

Write-Host ""
if ($failed -eq 0) {
  Write-Host "All smoke checks passed." -ForegroundColor Green
  exit 0
} else {
  Write-Host "$failed smoke check(s) FAILED." -ForegroundColor Red
  exit 1
}
