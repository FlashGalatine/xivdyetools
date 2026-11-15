$ErrorActionPreference = 'Continue'
$env:PYTHONIOENCODING = 'utf-8'
$out = 'docs/audits/2026-10-26-i18n/evidence'
$summary = [System.Collections.Generic.List[object]]::new()
function Run-Gate([string]$id, [string]$exe, [string[]]$arguments) {
  $started = Get-Date
  & $exe @arguments *> "$out/$id.txt"
  $code = $LASTEXITCODE
  $summary.Add([pscustomobject]@{id=$id;command="$exe $($arguments -join ' ')";exit=$code;seconds=[math]::Round(((Get-Date)-$started).TotalSeconds,1)})
  $summary | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 "$out/gate-summary.json"
  Write-Output "$id exit=$code"
}
Run-Gate 'web-validate' 'pnpm' @('--filter','xivdyetools-web-app','run','validate:i18n')
Run-Gate 'web-unused' 'pnpm' @('--filter','xivdyetools-web-app','run','i18n:unused')
Run-Gate 'web-i18n-tests' 'pnpm' @('--filter','xivdyetools-web-app','exec','vitest','run','scripts/i18n-parity-gate.test.js','src/__tests__/i18n-orphans.test.ts','src/components/__tests__/v4/locale-switch.test.ts','--coverage.enabled=false')
Run-Gate 'bot-i18n-tests' 'pnpm' @('--filter','@xivdyetools/bot-logic','exec','vitest','run','src/i18n','--coverage.enabled=false')
Run-Gate 'core-locale-tests' 'pnpm' @('--filter','@xivdyetools/core','exec','vitest','run','scripts/build-locales.test.ts','band-vocabulary.parity.test.ts','DyeSearch.parity.test.ts','--coverage.enabled=false')
Run-Gate 'og-i18n-font-tests' 'pnpm' @('--filter','xivdyetools-og-worker','exec','vitest','run','src/services/og-strings.test.ts','src/services/svg/roles-i18n.test.ts','src/services/svg/harmony.deck-fit.test.ts','src/og-data-generator.test.ts','src/services/font-coverage.test.ts','src/services/font-faces.test.ts','--coverage.enabled=false')
Run-Gate 'discord-i18n-font-tests' 'pnpm' @('--filter','xivdyetools-discord-worker','exec','vitest','run','src/services/bot-i18n.test.ts','src/services/i18n.test.ts','src/services/locale-and-fonts.test.ts','src/services/font-coverage.test.ts','src/services/font-faces.test.ts','--coverage.enabled=false')
Run-Gate 'policy-parity' 'python' @('.agents/skills/audit-shared/scripts/policy-locale-parity.py')
foreach ($set in @(@('web','apps/web-app/src/locales'),@('bot','packages/bot-logic/src/i18n/locales'),@('core','packages/core/src/data/locales'))) {
  Run-Gate "locale-diff-$($set[0])" 'python' @("$out/scripts/locale-diff.py",$set[1])
}
Run-Gate 'script-inventory' 'python' @("$out/scripts/script-inventory.py",'packages/core/src/data/locales','packages/bot-logic/src/i18n/locales','apps/og-worker/src/services/og-strings.ts')
Run-Gate 'american-spelling' 'node' @('.agents/skills/audit-shared/scripts/american-spelling.mjs','.','--all','apps/web-app/src/locales/en.json','packages/bot-logic/src/i18n/locales/en.json','packages/core/src/data/locales/en.json','apps/og-worker/src/services/og-strings.ts','apps/og-worker/src/services/og-embed.ts')
Run-Gate 'web-eslint' 'pnpm' @('--filter','xivdyetools-web-app','exec','eslint','src','-f','json')
