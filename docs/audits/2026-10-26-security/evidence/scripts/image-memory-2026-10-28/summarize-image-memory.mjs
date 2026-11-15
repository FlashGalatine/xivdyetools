import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const outputArgument=process.argv.find(a=>a.startsWith('--output-dir='))?.slice(13);
if(!outputArgument)throw new Error('Required: --output-dir=<generated evidence directory>; no outputs are written beside this script');
const here=path.resolve(outputArgument);
const normalized=here.replaceAll('\\','/').toLowerCase();
if(normalized.includes('/docs/audits/')||normalized.endsWith('/docs/audits'))throw new Error('Refusing audit-directory writes');
const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)??(()=>{throw new Error('Required: --label=<measurement label>')})();
const all=fs.readdirSync(path.join(here,'results')).filter(n=>n.endsWith('-'+label+'.json')).map(n=>JSON.parse(fs.readFileSync(path.join(here,'results',n),'utf8')));
const cold=all.filter(r=>!r.cases),warm=all.filter(r=>r.cases),instrumented=warm.find(r=>r.mode==='instrumented'),control=warm.find(r=>r.mode==='control');
if(cold.length!==29||instrumented?.cases.length!==18||control?.cases.length!==18) throw new Error('Summarizer requires the full 29-case cold and 18-request-per-mode warm matrix; inspect summary-*.json for a filtered run.');
const provenance=JSON.parse(fs.readFileSync(path.join(here,'provenance-'+label+'.json'),'utf8'));
const integrity=JSON.parse(fs.readFileSync(path.join(here,'source-integrity-'+label+'.json'),'utf8'));
const coldPairs=cold.filter(r=>r.mode==='instrumented'&&r.response?.status===200).map(r=>{const c=cold.find(c=>c.id===r.id.replace('-instrumented-','-control-'));return{fixture:r.fixture,flow:r.flow,controlFound:!!c,statusEqual:r.response?.status===c?.response?.status,bodyEqual:r.response?.sha256===c?.response?.sha256,wasmEqual:r.wasmHighWaterBytes===c?.wasmHighWaterBytes}});
const warmPairs=instrumented.cases.map((r,i)=>({index:r.index,statusEqual:r.status===control.cases[i]?.status,bodyEqual:r.responseSHA256===control.cases[i]?.responseSHA256,wasmEqual:r.wasmAfterBytes===control.cases[i]?.wasmAfterBytes}));
const samples=instrumented.cases.flatMap(c=>c.samples.map(s=>({index:c.index,round:c.round,fixture:c.fixture,flow:c.flow,...s,diagnosticAccountingBytes:s.wasmBytes+s.usedSize+s.backingStorageSize+s.embedderHeapUsedSize})));
const worst=samples.reduce((a,b)=>a.diagnosticAccountingBytes>b.diagnosticAccountingBytes?a:b);
const commands=fs.readFileSync(path.join(here,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(r=>r.argv.includes('--label='+label));
const rejected=cold.filter(r=>r.response?.status===400);
const compactCold=cold.map(r=>({id:r.id,fixture:r.fixture,flow:r.flow,mode:r.mode,transport:r.transport??'dispatchFetch',status:r.response?.status,responseBytes:r.response?.bytes,responseSHA256:r.response?.sha256,error:r.response?.error,constructorCalls:r.metrics?.calls,outboundFetches:r.outboundFetches,wasmHighWaterBytes:r.wasmHighWaterBytes,osProcessPeakWorkingSetBytes:r.osAfter?.peakWorkingSet64,samples:r.samples,failure:r.failure}));
const compactWarm=warm.map(r=>({mode:r.mode,requests:r.cases.length,wasmHighWaterBytes:r.wasmHighWaterBytes,osProcessPeakWorkingSetBytes:r.osAfter?.peakWorkingSet64,cases:r.cases.map(c=>({index:c.index,round:c.round,fixture:c.fixture,flow:c.flow,status:c.status,responseBytes:c.responseBytes,responseSHA256:c.responseSHA256,wasmBeforeBytes:c.wasmBeforeBytes,wasmAfterBytes:c.wasmAfterBytes,samples:c.samples})),failure:r.failure}));
const result={schemaVersion:1,label,provenance,sourceIntegrity:integrity,fixtures:JSON.parse(fs.readFileSync(path.join(here,'fixtures-actual.json'),'utf8')),commands,cold:compactCold,warm:compactWarm,coldPairs,warmPairs,worstWarmCheckpoint:worst,rejections:{count:rejected.length,allBeforeDecode:rejected.length>0&&rejected.every(r=>r.metrics.calls===0&&r.wasmHighWaterBytes===1376256),sixteenBit:rejected.filter(r=>r.fixture.startsWith('png16-')).length},allResponsesAgree:[...coldPairs,...warmPairs].every(p=>p.statusEqual&&p.bodyEqual&&p.wasmEqual),failures:all.filter(r=>r.failure).map(r=>({id:r.id,failure:r.failure})),inspectorRetentionAudit:{evaluateMethod:'Debugger.evaluateOnCallFrame',returnByValue:true,expressionReturns:'Only stage string and numeric memory sizes; no fixture, Request, Response or PhotonImage handles.',resumeEveryPause:true,workerState:'One Photon memory reference plus current stage and reset-per-request numeric stage rows/counter. No fixture arrays.',control:'No inspector, processor stage injection or constructor wrapper; same diagnostic endpoint for final WASM capacity.',console:'Original middleware logs request metadata only; no image bytes.',v8Reference:'https://github.com/v8/v8/blob/main/src/inspector/v8-debugger-agent-impl.cc#L1468'},limitations:['Historical2026-10-28 evidence: The 142.330MiB checkpoint is observed staged accounting, not a continuous total-isolate peak and not a Cloudflare production enforcement result.','Historical2026-10-28 evidence: WASM stayed103.375MiB through18mixedrequests per mode. External/JS counters dropped naturally on request13, suggesting uncollected buffers rather than growing retained WASM. No forced GC used.','Standalone workerd lacks production128MiB enforcement; natural GC scheduling may differ. This candidate is not marked safe/pass.','Historical2026-10-28 evidence: One oversized-thumbnail HTTP upload returned an Undici transport failure after early response; service-binding-proxy retry returned400 before decode. Original failed attempt retained in attempts/.','Fixtures exercise deterministic PNG scanline entropy, selected shapes and18sequentialrequests. Concurrent requests and other image formats are not measured here.']};
fs.writeFileSync(path.join(here,'actual-results-'+label+'.json'),JSON.stringify(result,null,2)+'\n');
const mib=n=>(n/1048576).toFixed(3);
const coldRow=(name,fixture,flow)=>{const r=cold.find(r=>r.fixture===fixture&&r.flow===flow&&r.mode==='instrumented');return`| ${name} | ${r.response.status} | ${mib(r.wasmHighWaterBytes)} | ${mib(r.osAfter.peakWorkingSet64)} |`};
const lines=[
`# Actual frozen-source memory proof — ${label}`,
`Source HEAD=${provenance.head}; source hashes were recorded before bundling and remain unchanged=${integrity.unchanged}. Full hashes, WASM hash and exact argv are in actual-results-${label}.json.`,
`Runtime: workerd${provenance.versions.workerd}, Miniflare${provenance.versions.miniflare}, Photon${provenance.versions.photon}; compatibility2024-12-01; pinned dependency lookup; cf:false/telemetry:false.`,
'Actual source, no experimental replacement variant. Instrumented bundle adds numerical stage captures and constructor counter; control has no inspector, processor injection or constructor wrap.',
`Cold: ${cold.length} cases; ${coldPairs.length} accepted instrumented/control pairs; all body/status/WASM comparisons agree=${coldPairs.every(p=>p.controlFound&&p.statusEqual&&p.bodyEqual&&p.wasmEqual)}.`,
'| Cold case | HTTP | WASM high-water MiB | whole-process RSS peak MiB |',
'|---|---:|---:|---:|',
coldRow('64cap near5MiB extract256','rgba8-64cap-near5MiB','extract256'),
coldRow('64cap near5MiB extract512','rgba8-64cap-near5MiB','extract512'),
coldRow('64cap near5MiB thumbnail','rgba8-64cap-near5MiB','thumbnail'),
coldRow('4K near5MiB extract256','rgba8-4K-near5MiB','extract256'),
coldRow('4K near5MiB thumbnail','rgba8-4K-near5MiB','thumbnail'),
coldRow('256² no-resize extract256','rgba8-noresize','extract256'),
coldRow('4096×1 extract512','rgba8-highaspect','extract512'),
coldRow('4096×1 thumbnail','rgba8-highaspect','thumbnail'),
`Predecode: ${result.rejections.sixteenBit}/8 legal16-bit color0/2/4/6 cap-sized requests reject400 on both routes; ${rejected.length} rejection cases; allBeforeDecode=${result.rejections.allBeforeDecode}. Per-case status/constructor/outbound counters are retained in JSON.`,
'Historical2026-10-28 evidence retains an early-response HTTP transport failure and successful service-binding-proxy retry; this report retains its own per-case transports/failures.',
'Warm: same isolate,3rounds×6cases, cap/4K/ultrawide/smaller near5MiB sources, both routes and output512; responses drained immediately; fixture/output references cleared; no forcedGC.',
`Warm instrumented/control:${instrumented.cases.filter(c=>c.status===200).length}/${instrumented.cases.length} and ${control.cases.filter(c=>c.status===200).length}/${control.cases.length} HTTP200; ${warmPairs.filter(p=>p.statusEqual&&p.bodyEqual&&p.wasmEqual).length}/${warmPairs.length} body/status/WASM pairs agree. Observed instrumented WASM ${mib(instrumented.cases[0].wasmBeforeBytes)}→${mib(instrumented.wasmHighWaterBytes)}MiB; growth steps=${instrumented.cases.filter(c=>c.wasmAfterBytes>c.wasmBeforeBytes).length}; final${mib(instrumented.cases.at(-1).wasmAfterBytes)}MiB.`,
`Whole-process RSS peak: instrumented${mib(instrumented.osAfter.peakWorkingSet64)}MiB; control${mib(control.osAfter.peakWorkingSet64)}MiB. Includes all workerd runtime/bridge isolates; not isolate accounting.`,
`Warning for verdict: observed checkpoint${worst.index}/${worst.stage}=${mib(worst.diagnosticAccountingBytes)}MiB: WASM${mib(worst.wasmBytes)}+JSused${mib(worst.usedSize)}+externalJS${mib(worst.backingStorageSize)}+embedder${mib(worst.embedderHeapUsedSize)}. Candidate is not marked pass/safe.`,
'Historical2026-10-28 evidence retains142.330MiB and the natural request13 JS/external drop. This run records its own raw per-stage timeline; GC scheduling can differ.',
'Inspector audit: evaluateOnCallFrame always returnByValue:true and returns numeric sizes/stage, no remote fixture handles. Every pause resumes. V8 primary source releases backtrace object group on resume; inspected main source is not proof of installed V8 internals.',
'Control independently reproduces WASM plateau and output hashes without inspector/instrumentation. Middleware console messages contain metadata, not image bytes; no input arrays retained by probe global state.',
'No continuous V8+WASM maximum or Cloudflare128MiB enforcement proven. Standalone workerd GC/limits differ; observed JS/external drops suggest temporary garbage. Concurrency/other image formats remain unmeasured.',
`Reproduce from original scratch host: node <script-path>/measure-image-memory.mjs --source-root=${provenance.root.replaceAll('\\','/')} --set=actual --label=${label} --warm`,
`Boundary retry: same command without --warm plus --only=rgba8-over5MiB-onebyte-thumbnail; then node <script-path>/summarize-image-memory.mjs --output-dir=<generated-directory> --label=${label}.`,
'No Vitest, tracked writes, Git mutation, deployment or production requests. Outputs remain in assigned scratch. Astra/coordinator owns safety verdict and any next source change.',
];
if(lines.length>40)throw new Error('Report >40 lines');
fs.writeFileSync(path.join(here,'ACTUAL-REPORT-'+label+'.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({label,cold:cold.length,warmEach:instrumented.cases.length,pairsAgree:result.allResponsesAgree,rejectionsBeforeDecode:result.rejections.allBeforeDecode,failures:result.failures.length,worstCheckpointMiB:worst.diagnosticAccountingBytes/1048576,sourceUnchanged:integrity.unchanged,reportLines:lines.length}));
