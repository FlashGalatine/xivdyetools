param([switch]$FinalPass)
$ErrorActionPreference = 'Continue'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$evidence = $PSScriptRoot
$env:PYTHONIOENCODING = 'utf-8'

function Invoke-Captured {
  param([string]$Id, [string]$WorkDir, [string]$Exe, [string[]]$CommandArgs)
  $log = Join-Path $evidence ($Id + '.log')
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $Exe
  $psi.WorkingDirectory = $WorkDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
  foreach ($a in $CommandArgs) { [void]$psi.ArgumentList.Add($a) }
  $p = [Diagnostics.Process]::new(); $p.StartInfo = $psi
  $started = $p.Start()
  $stdoutTask = $p.StandardOutput.ReadToEndAsync(); $stderrTask = $p.StandardError.ReadToEndAsync(); $out = $stdoutTask.GetAwaiter().GetResult(); $err = $stderrTask.GetAwaiter().GetResult()
  $p.WaitForExit(); $code = $p.ExitCode
  [IO.File]::WriteAllText($log, $out + $err, [Text.UTF8Encoding]::new($false))
  $lines = if ([string]::IsNullOrEmpty($out + $err)) { 0 } else { (($out + $err) -split "`r?`n").Count }
  Write-Host ('Finished ' + $Id + ': exit=' + $code)
  [PSCustomObject]@{ id=$Id; command=($Exe + ' ' + ($CommandArgs -join ' ')); cwd=$WorkDir; exit=$code; lines=$lines; log=$log }
}

$pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
if (-not $pnpm) { $pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue).Source }
$results = [Collections.Generic.List[object]]::new()
if ($FinalPass) {
  foreach ($unit in @('apps/discord-worker','apps/moderation-worker','apps/og-worker','packages/bot-logic')) {
    $id = 'tsc-refreshed-' + ($unit -replace '[\\/]','-')
    $results.Add((Invoke-Captured $id (Join-Path $root $unit) $pnpm @('exec','tsc','--noEmit','--noUnusedLocals','--noUnusedParameters')))
  }
  foreach ($task in @('type-check:scripts','test:scripts','docs:check-links','docs:check-versions')) {
    $results.Add((Invoke-Captured ($task -replace ':','-') $root $pnpm @('run',$task)))
  }
  foreach ($unit in @('api-worker','discord-worker','image-worker','moderation-worker','oauth','og-worker','presets-api')) {
    $results.Add((Invoke-Captured ('bundle-' + $unit) (Join-Path $root ('apps/' + $unit)) $pnpm @('exec','wrangler','deploy','--dry-run','--outdir',(Join-Path $evidence ('bundle-before-' + $unit)))))
  }
  $results | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $evidence 'collection-final-results.json')
  $results | ForEach-Object { "$($_.id)`texit=$($_.exit)`tlines=$($_.lines)`t$($_.log)" }
  exit 0
}
$results.Add((Invoke-Captured 'root-knip' $root $pnpm @('exec','knip','--no-config-hints','--no-tag-hints')))
$results.Add((Invoke-Captured 'web-app-knip' (Join-Path $root 'apps/web-app') $pnpm @('exec','knip')))
$og = Join-Path $root 'apps/og-worker'
$results.Add((Invoke-Captured 'og-worker-knip' $og $pnpm @('exec','knip')))
$results.Add((Invoke-Captured 'og-worker-knip-production' $og $pnpm @('exec','knip','--production')))
$results.Add((Invoke-Captured 'dead-code-check' $root $pnpm @('dead-code:check')))

$units = @('apps/api-worker','apps/discord-worker','apps/image-worker','apps/moderation-worker','apps/oauth','apps/og-worker','apps/presets-api','apps/stoat-worker','apps/web-app','packages/auth','packages/bot-logic','packages/core','packages/logger','packages/svg','packages/test-utils','packages/types','packages/worker-kit')
foreach ($unit in $units) {
  $id = 'tsc-' + ($unit -replace '[\\/]','-')
  $results.Add((Invoke-Captured $id (Join-Path $root $unit) $pnpm @('exec','tsc','--noEmit','--noUnusedLocals','--noUnusedParameters')))
}
$results.Add((Invoke-Captured 'web-app-i18n-unused' (Join-Path $root 'apps/web-app') $pnpm @('run','i18n:unused','--','--json')))
$results.Add((Invoke-Captured 'bot-logic-i18n-tests' (Join-Path $root 'packages/bot-logic') $pnpm @('exec','vitest','run','src/i18n')))
$results.Add((Invoke-Captured 'baseline-turbo' $root $pnpm @('turbo','run','type-check','lint','test','--continue','--concurrency=2')))

$results | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $evidence 'collection-results.json')
$results | ForEach-Object { "$($_.id)`texit=$($_.exit)`tlines=$($_.lines)`t$($_.log)" }

