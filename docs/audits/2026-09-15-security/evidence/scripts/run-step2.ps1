$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$out = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tmp = Join-Path $out '.collector-tmp'
Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

function Save-Command($name, $scriptBlock) {
  $path = Join-Path $out $name
  & $scriptBlock *> $path
  $code = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
  Set-Content -Path (Join-Path $out ($name + '.status.txt')) -Value "collector-exit-code=$code"
}

Push-Location $repo
try {
  Save-Command 'pnpm-audit.json' { pnpm audit --prod --json }
  Save-Command 'pnpm-audit-summary.txt' { pnpm audit --prod --audit-level high }

  $gitleaks = Get-Command gitleaks -ErrorAction SilentlyContinue
  if ($null -eq $gitleaks) {
    Set-Content (Join-Path $out 'gitleaks-tree.json') '{"collector_status":"BLOCKED","reason":"gitleaks binary unavailable"}'
    Set-Content (Join-Path $out 'gitleaks-history.json') '{"collector_status":"BLOCKED","reason":"gitleaks binary unavailable"}'
  } else {
    & gitleaks.Source dir . -c .gitleaks.toml -f json -r (Join-Path $tmp 'tree.json') --no-banner *> (Join-Path $tmp 'tree.log')
    & gitleaks.Source git . -c .gitleaks.toml -f json -r (Join-Path $tmp 'history.json') --no-banner *> (Join-Path $tmp 'history.log')
    foreach ($kind in @('tree','history')) {
      $raw = if (Test-Path (Join-Path $tmp ($kind + '.json'))) { Get-Content -Raw (Join-Path $tmp ($kind + '.json')) } else { '[]' }
      # Do not copy Match/Secret fields from scanner output into audit artifacts.
      $redacted = $raw -replace '(?i)("(?:Match|Secret|Line)"\s*:\s*")([^"\\]*(?:\\.[^"\\]*)*)(")', '$1[REDACTED]$3'
      Set-Content -Path (Join-Path $out ('gitleaks-' + $kind + '.json')) -Value $redacted
      if (Test-Path (Join-Path $tmp ($kind + '.log'))) { Copy-Item (Join-Path $tmp ($kind + '.log')) (Join-Path $out ('gitleaks-' + $kind + '.log')) -Force }
    }
  }
  Add-Content (Join-Path $out 'collector-debug.txt') 'after-gitleaks'

  $tracked = @(git ls-files)
  Add-Content (Join-Path $out 'collector-debug.txt') ("tracked=$($tracked.Count)")
  $textTracked = $tracked | Where-Object { $_ -match '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' }
  $secretPattern = '(?i)(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}[\"\x27][^\"\x27]{12,}[\"\x27]'
  $secretHits = @()
  foreach ($f in $textTracked) {
    $lines = Get-Content -LiteralPath $f -ErrorAction SilentlyContinue
    for ($i=0; $i -lt @($lines).Count; $i++) {
      if ($lines[$i] -match $secretPattern) { $secretHits += ("{0}:{1}: [REDACTED potential secret]" -f $f, ($i+1)) }
    }
  }
  if ($secretHits.Count) { $secretHits | Set-Content (Join-Path $out 'potential-secrets.txt') } else { Set-Content (Join-Path $out 'potential-secrets.txt') '[no potential-secret pattern hits]' }

  $wrangler = $tracked | Where-Object { $_ -match '(^|/)wrangler\.toml$' }
  $surface = foreach ($f in $wrangler) { Select-String -Path $f -Pattern '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain' | ForEach-Object { "$f`:$($_.LineNumber):$($_.Line)" } }
  if ($surface) { $surface | Set-Content (Join-Path $out 'wrangler-surface.txt') } else { Set-Content (Join-Path $out 'wrangler-surface.txt') '[no wrangler surface matches]' }
  git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* 2>> (Join-Path $out 'wrangler-surface.txt') | Add-Content (Join-Path $out 'wrangler-surface.txt')

  git diff --stat 4c213248..HEAD -- . | Set-Content (Join-Path $out 'delta-since-last-audit.txt')

  $ts = $tracked | Where-Object { $_ -match '\.ts$' -and $_ -notmatch '\.test\.ts$|/__tests__/' }
  $sink = 'writeDataPoint\(|\.put\(|\.prepare\(|INSERT INTO|localStorage\.setItem|sessionStorage\.setItem|indexedDB|sendBeacon\(|logger\.(info|warn|error|debug)\('
  $source = 'cf-connecting-ip|x-forwarded-for|x-real-ip|user-agent|navigator\.userAgent|\bemail\b|global_name|\bdiscriminator\b|\bavatar\b|\busername\b|guild_id|channel_id|guild_locale|\blocale\b|TypeName|Nickname|nickname|filename|crypto\.randomUUID\(\)|Date\.now\(\).*(id|session)'
  $sinkHits = foreach ($f in $ts) { Select-String -Path $f -Pattern $sink -ErrorAction SilentlyContinue | ForEach-Object { "$f`:$($_.LineNumber):$($_.Line)" } }
  $sourceHits = foreach ($f in $ts) { Select-String -Path $f -Pattern $source -ErrorAction SilentlyContinue | ForEach-Object { "$f`:$($_.LineNumber):$($_.Line)" } }
  if ($sinkHits) { $sinkHits | Set-Content (Join-Path $out 'pii-sinks.txt') } else { Set-Content (Join-Path $out 'pii-sinks.txt') '[no PII sink matches]' }
  if ($sourceHits) { $sourceHits | Set-Content (Join-Path $out 'pii-sources.txt') } else { Set-Content (Join-Path $out 'pii-sources.txt') '[no PII source matches]' }

  @("commit=$(git rev-parse --short HEAD)", "branch=$(git branch --show-current)", 'status:') + @(git status --porcelain) + @('recent commits:') + @(git log --oneline --decorate -n 30 4c213248..HEAD) | Set-Content (Join-Path $out 'git-context.txt')
  Get-ChildItem -Path packages,apps -Filter package.json -Recurse | ForEach-Object { Select-String -Path $_.FullName -Pattern '"version"\s*:' } | ForEach-Object { $_.Path + ':' + $_.LineNumber + ':' + $_.Line.Trim() } | Set-Content (Join-Path $out 'versions.txt')
} finally {
  Pop-Location
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
