$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$out = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repo
try {
  $tracked = @(git ls-files)
  $textTracked = @($tracked | Where-Object { $_ -match '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' })
  $secretPattern = '(?i)(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}[\"\x27][^\"\x27]{12,}[\"\x27]'
  $secretHits = @()
  foreach ($f in $textTracked) { $lines = @(Get-Content -LiteralPath $f -ErrorAction SilentlyContinue); for ($i=0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match $secretPattern) { $secretHits += ("{0}:{1}: [REDACTED potential secret]" -f $f, ($i+1)) } } }
  if ($secretHits.Count) { $secretHits | Set-Content (Join-Path $out 'potential-secrets.txt') } else { Set-Content (Join-Path $out 'potential-secrets.txt') '[no potential-secret pattern hits]' }
  $wrangler = @($tracked | Where-Object { $_ -match '(^|/)wrangler\.toml$' })
  $surface = @($wrangler | ForEach-Object { Select-String -Path $_ -Pattern '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain' | ForEach-Object { "$_`:$($_.LineNumber):$($_.Line)" } })
  if ($surface.Count) { $surface | Set-Content (Join-Path $out 'wrangler-surface.txt') } else { Set-Content (Join-Path $out 'wrangler-surface.txt') '[no wrangler surface matches]' }
  git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* 2>> (Join-Path $out 'wrangler-surface.txt') | Add-Content (Join-Path $out 'wrangler-surface.txt')
  git diff --stat 4c213248..HEAD -- . | Set-Content (Join-Path $out 'delta-since-last-audit.txt')
  $ts = @($tracked | Where-Object { $_ -match '\.ts$' -and $_ -notmatch '\.test\.ts$|/__tests__/' })
  $sink = 'writeDataPoint\(|\.put\(|\.prepare\(|INSERT INTO|localStorage\.setItem|sessionStorage\.setItem|indexedDB|sendBeacon\(|logger\.(info|warn|error|debug)\('
  $source = 'cf-connecting-ip|x-forwarded-for|x-real-ip|user-agent|navigator\.userAgent|\bemail\b|global_name|\bdiscriminator\b|\bavatar\b|\busername\b|guild_id|channel_id|guild_locale|\blocale\b|TypeName|Nickname|nickname|filename|crypto\.randomUUID\(\)|Date\.now\(\).*(id|session)'
  $sinkHits = @($ts | ForEach-Object { Select-String -Path $_ -Pattern $sink -ErrorAction SilentlyContinue | ForEach-Object { "$_`:$($_.LineNumber):$($_.Line)" } })
  $sourceHits = @($ts | ForEach-Object { Select-String -Path $_ -Pattern $source -ErrorAction SilentlyContinue | ForEach-Object { "$_`:$($_.LineNumber):$($_.Line)" } })
  if ($sinkHits.Count) { $sinkHits | Set-Content (Join-Path $out 'pii-sinks.txt') } else { Set-Content (Join-Path $out 'pii-sinks.txt') '[no PII sink matches]' }
  if ($sourceHits.Count) { $sourceHits | Set-Content (Join-Path $out 'pii-sources.txt') } else { Set-Content (Join-Path $out 'pii-sources.txt') '[no PII source matches]' }
  @("commit=$(git rev-parse --short HEAD)", "branch=$(git branch --show-current)", 'status:') + @(git status --porcelain) + @('recent commits:') + @(git log --oneline --decorate -n 30 4c213248..HEAD) | Set-Content (Join-Path $out 'git-context.txt')
  Get-ChildItem -Path packages,apps -Filter package.json -Recurse | ForEach-Object { Select-String -Path $_.FullName -Pattern '"version"\s*:' } | ForEach-Object { $_.Path + ':' + $_.LineNumber + ':' + $_.Line.Trim() } | Set-Content (Join-Path $out 'versions.txt')
} finally { Pop-Location }
