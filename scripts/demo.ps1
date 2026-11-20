# Uso: powershell -NoProfile -File scripts/demo.ps1 (con Docker Desktop abierto).
$ErrorActionPreference = 'Continue' # PowerShell 5.1 trata stderr de comandos nativos como error.
Set-Location (Join-Path $PSScriptRoot '..') -ErrorAction Stop
$env:npm_config_cache = Join-Path $env:TEMP 'decisionos-npm-cache'

$status = npx.cmd supabase status -o env
if ($LASTEXITCODE -ne 0) {
  npx.cmd supabase start | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar Supabase local.' }
  $status = npx.cmd supabase status -o env
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el estado de Supabase local.' }
}
$local = @{}
foreach ($line in $status) {
  if ($line -match '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)="?([^"]+)"?$') {
    $local[$Matches[1]] = $Matches[2]
  }
}
if ($local.API_URL -notmatch '^http://(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?/?$' -or
    -not $local.PUBLISHABLE_KEY -or -not $local.SECRET_KEY) {
  throw 'El estado de Supabase debe incluir una URL local y las dos claves.'
}

$path = Join-Path (Get-Location).Path '.env.local'
$values = [ordered]@{
  NEXT_PUBLIC_SUPABASE_URL = $local.API_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $local.PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY = $local.SECRET_KEY
  MAIL_DRIVER = 'mailpit'
  AI_DRIVER = 'fake'
  APP_URL = 'http://127.0.0.1:3000'
}
$lines = @()
$cronSecret = $null
if ([IO.File]::Exists($path)) {
  $lines = [IO.File]::ReadAllLines($path)
  $cronSecret = node -e "const env = require('node:util').parseEnv(require('node:fs').readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')); process.stdout.write(env.CRON_SECRET ?? '')"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer CRON_SECRET de .env.local.' }
}
if (-not $cronSecret) {
  $cronSecret = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar CRON_SECRET.' }
  $values.CRON_SECRET = $cronSecret
}
$managed = '^\s*(?:export\s+)?(' + ($values.Keys -join '|') + ')\s*='
$lines = @($lines | Where-Object { $_ -cnotmatch $managed })
foreach ($name in $values.Keys) {
  $lines += "$name=$($values[$name])"
}
[IO.File]::WriteAllLines($path, [string[]]$lines, [Text.UTF8Encoding]::new($false))
foreach ($name in $values.Keys) {
  Set-Item -LiteralPath "env:$name" -Value $values[$name]
}
$env:CRON_SECRET = $cronSecret

node scripts/demo-seed.ts
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cargar la demo.' }

Write-Host 'App:     http://127.0.0.1:3000'
Write-Host 'Mailpit: http://127.0.0.1:54324'
Write-Host 'Studio:  http://127.0.0.1:54323'
Write-Host 'Demo:    demo@decisionos.local / demo-decisionos-2026'

# next dev no ejecuta los barridos de Vercel. Procesa la cola cuando responda.
$sweep = Start-Job -ScriptBlock {
  $deadline = [DateTime]::UtcNow.AddMinutes(2)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Method Post `
        -Uri 'http://127.0.0.1:3000/api/jobs/run' -MaximumRedirection 0 -TimeoutSec 15 `
        -Headers @{ Authorization = "Bearer $env:CRON_SECRET" } -ErrorAction Stop
      if ($response.StatusCode -eq 204) { return }
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ([DateTime]::UtcNow -lt $deadline)
  Write-Warning 'El barrido local de insights no pudo completarse.'
}
try {
  npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
} finally {
  if ($sweep) {
    Stop-Job $sweep
    Receive-Job $sweep
    Remove-Job $sweep
  }
}
