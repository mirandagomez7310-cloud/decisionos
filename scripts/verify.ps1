# Secuencia del job `db` del CI en local: pila Supabase, pgTAP, build, E2E y Lighthouse.
# Uso: powershell -NoProfile -File scripts/verify.ps1   (Docker Desktop debe estar abierto)
$ErrorActionPreference = 'Continue' # 5.1: con Stop, el stderr de npx/npm se vuelve error terminante
Set-Location (Join-Path $PSScriptRoot '..')
$status = npx.cmd supabase status -o env
if ($LASTEXITCODE -ne 0) { npx.cmd supabase start | Out-Null; $status = npx.cmd supabase status -o env }
foreach ($line in $status) {
  if ($line -match '^(\w+)="?([^"]*)"?$') { Set-Item -Path "env:$($Matches[1])" -Value $Matches[2] }
}
$env:NEXT_PUBLIC_SUPABASE_URL = $env:API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $env:PUBLISHABLE_KEY
$env:SUPABASE_SECRET_KEY = $env:SECRET_KEY
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $env:TEMP 'decisionos-playwright'
$results = @()
foreach ($step in 'test:db', 'build', 'test:e2e', 'lhci') {
  $out = npm.cmd run $step 2>&1
  $ok = $LASTEXITCODE -eq 0
  $results += "$step : $(if ($ok) { 'OK' } else { 'FALLA' })"
  if (-not $ok) { $out | Select-Object -Last 40; break }
}
$results
