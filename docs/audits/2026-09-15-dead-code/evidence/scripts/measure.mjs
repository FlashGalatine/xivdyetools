import fs from 'node:fs';
import ts from 'typescript';
const out='docs/audits/2026-09-15-dead-code/evidence';
const targets={
 'apps/web-app/src/components/__tests__/empty-state.test.ts':['setOptions'],
 'apps/web-app/src/components/__tests__/offline-banner.test.ts':['onStatusChange','updateMessage'],
 'apps/moderation-worker/src/services/ban-service.test.ts':['hideUserPresets','restoreUserPresets'],
 'apps/moderation-worker/src/utils/url-sanitizer.test.ts':['sanitizeHeaders','sanitizeFetchRequest','sanitizeFetchResponse'],
 'apps/moderation-worker/src/services/bot-i18n.test.ts':['getMeta()'],
 'apps/discord-worker/src/services/preferences.exhaustive.test.ts':['getPreference'],
 'apps/presets-api/tests/services/moderation-service.test.ts':['truncateUnicodeSafe'],
 'apps/presets-api/tests/utils/api-response.test.ts':['duplicateResponse returns 409 DUPLICATE_RESOURCE'],
 'apps/presets-api/tests/types.test.ts':['VoteRow should track vote timestamps'],
};
const rows=[];
for(const [file,names] of Object.entries(targets)){
 const src=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function visit(n){
  if(ts.isCallExpression(n)&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&names.includes(n.arguments[0].text)){
   const line=src.getLineAndCharacterOfPosition(n.getStart(src)).line+1,end=src.getLineAndCharacterOfPosition(n.end).line+1;
   rows.push({file,label:n.arguments[0].text,line,end,lines:end-line+1});
  }
  ts.forEachChild(n,visit);
 }visit(src);
}
fs.writeFileSync(`${out}/test-removal-spans.json`,JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows));
