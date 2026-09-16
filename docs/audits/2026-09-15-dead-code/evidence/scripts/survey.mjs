// Audit-only candidate generator. References are syntax tokens, not reachability verdicts.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const out = 'docs/audits/2026-09-15-dead-code/evidence';
const files = execFileSync('git', ['ls-files'], {encoding:'utf8'}).trim().split('\n');
const sources = files.filter(f => /\.(ts|tsx|js|mjs|cjs)$/.test(f) && !/^(docs\/|.*\/coverage\/|.*e2e-coverage\/)/.test(f));
const isTest = f => /\.(test|spec)\.[cm]?[tj]sx?$|\/(__tests__|e2e|tests?|integration)\//.test(f);
const refs = new Map(), members = [], exports = [], inventory = {};
for (const f of sources) {
  if (!fs.existsSync(f)) continue;
  const source = ts.createSourceFile(f, fs.readFileSync(f,'utf8'), ts.ScriptTarget.Latest, true);
  const unit = /^(apps|packages)\//.test(f) ? f.split('/').slice(0,2).join('/') : 'root';
  inventory[unit] = (inventory[unit] || 0) + 1;
  const add = (arr,node,name,kind) => {
    const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
    const end = source.getLineAndCharacterOfPosition(node.end).line+1;
    arr.push({file:f,line:start,end,lines:end-start+1,name,kind,unit});
  };
  function walk(node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (!refs.has(name)) refs.set(name,new Map());
      const byFile = refs.get(name);
      byFile.set(f,(byFile.get(f)||0)+1);
    }
    if (!isTest(f)) {
      if (ts.isClassDeclaration(node)) for (const m of node.members) {
        if (!m.name || !ts.isIdentifier(m.name) || m.modifiers?.some(x=>[ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword].includes(x.kind))) continue;
        if (ts.isMethodDeclaration(m)||ts.isGetAccessorDeclaration(m)||ts.isSetAccessorDeclaration(m)||ts.isPropertyDeclaration(m)&&m.initializer&&(ts.isArrowFunction(m.initializer)||ts.isFunctionExpression(m.initializer))) add(members,m,m.name.text,`${node.name?.text||'default'}.${ts.SyntaxKind[m.kind]}`);
      }
      if (node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) {
        if (node.name && ts.isIdentifier(node.name)) add(exports,node,node.name.text,ts.SyntaxKind[node.kind]);
        if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if(ts.isIdentifier(d.name)) add(exports,d,d.name.text,'Variable');
      }
    }
    ts.forEachChild(node,walk);
  }
  walk(source);
}
for (const rows of [exports,members]) for (const row of rows) {
  const hits=[...(refs.get(row.name)||[])];
  row.self = hits.find(([f])=>f===row.file)?.[1]||0;
  row.prod = hits.filter(([f])=>f!==row.file&&!isTest(f)).map(([file,count])=>({file,count}));
  row.tests = hits.filter(([f])=>isTest(f)).map(([file,count])=>({file,count}));
}
fs.writeFileSync(`${out}/syntax-survey.json`,JSON.stringify({command:'node docs/audits/2026-09-15-dead-code/evidence/scripts/survey.mjs',limitations:'Name-based syntax references are candidate evidence only: declarations of unrelated same-named symbols count; computed string properties and Vue/HTML templates are not counted. Imports alone do not prove production reachability. Manual confirmation required.',inventory,exports,members},null,2)+'\n');
const candidates = [...exports.filter(x=>!x.prod.length),...members.filter(x=>!x.prod.length&&x.self===1)];
fs.writeFileSync(`${out}/syntax-candidates.txt`,candidates.map(x=>`${x.file}:${x.line}-${x.end} ${x.kind} ${x.name} self=${x.self} prodFiles=${x.prod.length} testFiles=${x.tests.length}`).join('\n')+'\n');
console.log(JSON.stringify({inventory,exports:exports.length,members:members.length,candidates:candidates.length}));
