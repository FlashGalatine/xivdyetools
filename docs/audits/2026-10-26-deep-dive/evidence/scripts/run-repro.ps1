$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
$scratch = Join-Path $repo 'apps/web-app/.audit-repro-20261026'
if (Test-Path -LiteralPath $scratch) { throw 'Scratch directory already exists' }
New-Item -ItemType Directory -Path $scratch | Out-Null
try {
  $test = Get-Content docs/audits/2026-10-26-deep-dive/evidence/scripts/repro-web.test.ts -Raw
  $test.Replace('../../../../../apps/web-app/', '../') | Set-Content -Encoding utf8 (Join-Path $scratch 'repro-web.test.ts')
  @'
import { mergeConfig } from 'vitest/config';
import base from '../vitest.config.ts';
export default mergeConfig(base, {test:{include:['.audit-repro-20261026/repro-web.test.ts'],coverage:{enabled:false}}});
'@ | Set-Content -Encoding utf8 (Join-Path $scratch 'vitest.config.mts')
  $ErrorActionPreference = 'Continue'
  pnpm --filter xivdyetools-web-app exec vitest run --config .audit-repro-20261026/vitest.config.mts .audit-repro-20261026/repro-web.test.ts --coverage.enabled=false *> docs/audits/2026-10-26-deep-dive/evidence/repro-web.txt
  $result = $LASTEXITCODE
} finally {
  $resolved = [IO.Path]::GetFullPath($scratch)
  $expected = [IO.Path]::GetFullPath((Join-Path $repo 'apps/web-app/.audit-repro-20261026'))
  if ($resolved -ne $expected -or -not $resolved.StartsWith($repo + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe scratch cleanup path' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Output "REPRO_EXIT=$result"
exit $result
