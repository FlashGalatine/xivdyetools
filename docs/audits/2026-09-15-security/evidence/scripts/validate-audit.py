"""Validate audit links/IDs/source anchors and preserve the reviewed excerpts."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

repo = Path(__file__).resolve().parents[5]
audit = repo / "docs/audits/2026-09-15-security"
errors = []
links = 0
for file in audit.rglob("*.md"):
    content = file.read_text(encoding="utf-8-sig")
    for target in re.findall(r"\]\(([^)]+)\)", content):
        target = target.split("#", 1)[0]
        if not target or re.match(r"^[a-z]+://", target):
            continue
        links += 1
        if not (file.parent / target).exists():
            errors.append(f"{file.relative_to(audit)}: broken link {target}")
    if file.name != 'source-excerpts.md' and any(line.rstrip() != line for line in content.splitlines()):
        errors.append(f"{file.relative_to(audit)}: trailing whitespace")

findings = sorted((audit / "findings").glob("FINDING-*.md"))
severities = {}
anchors = 0
for i, file in enumerate(findings, 1):
    if file.stem != f"FINDING-{i:03d}":
        errors.append(f"Non-sequential ID: {file.name}")
    content = file.read_text(encoding="utf-8")
    sev = re.search(r"\*\*Severity:\*\* (\w+)", content).group(1)
    severities[sev] = severities.get(sev, 0) + 1
    if "## Status\nOPEN" not in content:
        errors.append(f"Missing OPEN status: {file.name}")
    for path, line in re.findall(r"`((?:apps|packages)/[^`:]+):(\d+)(?:-\d+)?`", content):
        target = repo / path
        anchors += 1
        if not target.exists() or int(line) > len(target.read_text(encoding="utf-8").splitlines()):
            errors.append(f"Invalid source anchor {path}:{line}")

ranges = {
    "packages/auth/src/discord.ts": [(77, 143)],
    "apps/discord-worker/src/index.ts": [(315, 350), (491, 534), (681, 696)],
    "apps/discord-worker/src/handlers/buttons/preview-image.ts": [(153, 175)],
    "apps/moderation-worker/src/index.ts": [(155, 175)],
    "apps/presets-api/src/handlers/moderation.ts": [(198, 233), (254, 313)],
    "apps/presets-api/src/handlers/presets.ts": [(463, 502), (520, 538), (584, 600), (1136, 1151)],
    "apps/presets-api/src/services/preset-service.ts": [(467, 490), (685, 709)],
    "apps/og-worker/src/index.ts": [(501, 546)],
}
snapshots = ["# Reviewed source excerpts", "", "Snapshot commit: 0332fcc5768a4477301ed5b15590eee16a772f87", ""]
for path, segments in ranges.items():
    data = (repo / path).read_bytes()
    lines = data.decode("utf-8-sig").splitlines()
    snapshots.extend([f"## {path}", "", f"SHA256: `{hashlib.sha256(data).hexdigest()}`", "", "```text"])
    for start, end in segments:
        snapshots.extend(f"{n}: {lines[n-1]}".rstrip() for n in range(start, end + 1))
        snapshots.append("")
    snapshots.extend(["```", ""])
(audit / "evidence/source-excerpts.md").write_text("\n".join(snapshots), encoding="utf-8")
changed = subprocess.check_output(["git", "diff", "--name-only"], cwd=repo, text=True).splitlines()
if changed:
    errors.append(f"Tracked changes require review: {changed}")
result = {"findings": len(findings), "severity_counts": severities, "local_links_checked": links,
          "source_anchors_checked": anchors, "source_files_snapshotted": len(ranges),
          "tracked_files_changed": changed, "errors": errors}
(audit / "evidence/artifact-validation.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
raise SystemExit(bool(errors))
