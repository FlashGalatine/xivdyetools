## 1. Shell / grep (Bash examples on Windows)

- The skills' `bash` blocks assume Git Bash. Codex may start in PowerShell: explicitly select
  an available Bash executable or translate the block to native PowerShell, preserving command
  exit codes and evidence paths. Never mix shell syntax. Use the tool's working-directory
  argument on every call; do not assume `cd` persists between Codex calls.
- Replace `<SKILL_DIR>` with the actual directory containing the loaded `SKILL.md` (including
  linked skills). Replace `<TMP>` with a newly created run-specific directory under the platform's
  temp directory, and `<log-id>` with a filename-safe unit label such as `core` (not the pnpm
  filter `@xivdyetools/core`). In Git Bash, `cygpath -u` converts a Windows path. Resolve Python
  helpers from the skill's `scripts/`, not from the working checkout, which may be a worktree.
- In PowerShell, set `$env:PYTHONIOENCODING = 'utf-8'` for CJK output, inspect `$LASTEXITCODE`
  after native commands, and use `Get-Content -Encoding UTF8` for these instruction files.
  `symrefs.sh` still requires Bash. The remaining traps describe Git Bash behavior.

- **Search tracked files only**: use `git grep -n -w <sym> -- '<unit>/src/*.ts'` or feed tracked
  paths to `rg` for more complex searches. Plain
  `grep -r apps packages` is poisoned — `apps/web-app/e2e-coverage/*.json` embeds core's whole
  source and `apps/*/coverage/**/*.html` embed the apps; both create fake "consumers".
- `grep --include="*.{ts,js}"` brace expansion does not work in this shell — list globs explicitly
  or pipe `git ls-files` through `grep -E '\.(ts|js)$'`.
- `grep -P '\x{4E00}'` returns nothing here; scan CJK with python, and set
  `PYTHONIOENCODING=utf-8` before any script that prints CJK.
- Bash heredocs longer than ~100 lines and long command lines with many quoted args fail to parse
  — write the script/status text with the Write tool and run the file.
- `cd` persists between Bash calls; use absolute paths or `cd` at the start of each command.
- `stat -f%z` is macOS; use `wc -c < file` or `stat --printf=%s`.
