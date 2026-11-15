import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkFile, trackedPathSet } from '../../../../../scripts/check-doc-links.ts';

const roots = ['docs/audits/2026-10-26-deep-dive', 'docs/audits/2026-10-26-i18n'];
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const p = `${dir}/${name}`;
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const fresh = roots.flatMap(walk);
const tracked = execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n');
const known = trackedPathSet([...tracked, ...fresh]);
const errors: string[] = [];
let links = 0, json = 0, findingFiles = 0;
for (const file of [...fresh.filter(p => p.endsWith('.md')), 'docs/audits/index.md']) {
  const body = readFileSync(file, 'utf8');
  const result = checkFile(file,body,known);
  links += result.links;
  errors.push(...result.broken.map(b=>`${b.file}:${b.line} broken ${b.target}`));
  if (file.includes('/findings/')) {
    findingFiles++;
    if (body.trimEnd().split('\n').length > 25) errors.push(`${file}: >25 lines`);
    for (const m of body.matchAll(/`((?:apps|packages|scripts)\/[^`]+):(\d+)`/g)) {
      if (!existsSync(m[1])) errors.push(`${file}: absent source ${m[1]}`);
      else if (Number(m[2]) > readFileSync(m[1],'utf8').split('\n').length) errors.push(`${file}: invalid source line ${m[0]}`);
    }
  }
}
for (const file of fresh.filter(p=>p.endsWith('.json') && !p.endsWith('/archive-validation.json'))) {
  try { JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')); json++; }
  catch (e) { errors.push(`${file}: invalid JSON: ${e}`); }
}
const catalogFolders = ['2026-10-26-security','2026-10-26-xivcharakit-dead-code','2026-10-26-deep-dive','2026-10-26-i18n'];
const ids = catalogFolders.flatMap(folder => JSON.parse(readFileSync(`docs/audits/${folder}/evidence/final-catalog.json`,'utf8')).findings.map((f:any)=>`${folder}/${f.id}`));
const plan = JSON.parse(readFileSync(`${roots[1]}/evidence/plan-assignments.json`,'utf8'));
const assigned = [...plan.scheduled, ...plan.keep, ...plan.superseded].map((r:any)=>r.id);
for (const id of ids) if (assigned.filter((a:string)=>a===id).length!==1) errors.push(`${id}: not assigned exactly once`);
for (const id of assigned) if (!ids.includes(id)) errors.push(`${id}: assignment outside catalogs`);
if (plan.keep.length!==23) errors.push('KEEP register must have 23 rows');
const report = readFileSync(`${roots[1]}/REMEDIATION_PLAN.md`,'utf8');
const mdIds=[...report.matchAll(/^\| \[([^\]]+\/(?:FINDING|DEAD|BUG|OPT|HC|I18N|TERM|FONT)-\d+)\]\(/gm)].map(m=>m[1]);
for (const id of ids) if (mdIds.filter(x=>x===id).length!==1) errors.push(`${id}: plan Markdown row not unique`);
const sourceCoverage=JSON.parse(readFileSync(`${roots[0]}/evidence/source-coverage.json`,'utf8'));
if(sourceCoverage.missing.length) errors.push('Unread source inventory gaps remain');
console.log(JSON.stringify({files:fresh.length,links,json,findingFiles,catalogIds:ids.length,scheduled:plan.scheduled.length,keep:plan.keep.length,superseded:plan.superseded.length,sourceCoverage,errors},null,2));
if(errors.length) process.exit(1);
