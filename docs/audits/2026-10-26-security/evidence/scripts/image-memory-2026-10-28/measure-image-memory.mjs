// Local workerd reproduction. Explicit --source-root required; generated outputs are git-ignored or external.
// --warm adds18requests per mode. --runtime-only-diagnostic --warm-only runs one Runtime-only18request sequence.
// --diagnostic-gc-at-end is opt-in and runs one idle GC after that sequence only; never a pass criterion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import cp from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const sourceArgument=process.argv.find(a=>a.startsWith('--source-root='))?.slice(14);
if(!sourceArgument)throw new Error('Required: --source-root=<checkout>. Outputs are never written beside this script.');
const root=path.resolve(sourceArgument);
if(!fs.existsSync(path.join(root,'apps/image-worker/src/photon.ts')))throw new Error('Source root is not the intended monorepo checkout');
const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)??('local-'+Date.now());
if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('Invalid label');
const outputArgument=process.argv.find(a=>a.startsWith('--output-dir='))?.slice(13);
const here=outputArgument?path.resolve(root,outputArgument):path.join(root,'.superpowers/sdd/image-memory-repro-'+label);
const outputNormalized=here.replaceAll('\\','/').toLowerCase();
if(outputNormalized.includes('/docs/audits/')||outputNormalized.endsWith('/docs/audits'))throw new Error('Refusing to write generated files inside a committed audit directory');
const relativeOutput=path.relative(root,here);
if(!relativeOutput||(!relativeOutput.startsWith('..'+path.sep)&&relativeOutput!=='..'&&!path.isAbsolute(relativeOutput))){
 try{cp.execFileSync('git',['check-ignore','--quiet','--',relativeOutput],{cwd:root,stdio:'ignore'})}catch{throw new Error('Output directory inside checkout must be git-ignored; use default .superpowers output or an external temporary directory')}
}
if(process.argv.some(a=>a.startsWith('--variant=')))throw new Error('This reproduction runs actual source only; no experimental source replacement variants');
const variant='frozen-source';
process.env.MINIFLARE_CACHE_DIR=path.join(here,'miniflare-cache');
fs.mkdirSync(here,{recursive:true});
console.log('Generated evidence directory: '+here);
const store = path.join(root, 'node_modules/.pnpm');
const pinnedVersions={esbuild:'0.28.2',ws:'8.21.0',miniflare:'5.20261019.2-beta',workerd:'1.20261019.1','@cf-wasm+photon':'0.4.0'};
const pkg = (prefix, name) => {const start=prefix+'@'+pinnedVersions[prefix];const candidates=fs.readdirSync(store).filter(x=>x===start||x.startsWith(start+'_'));if(candidates.length!==1)throw new Error('Expected one pinned package '+start+', found '+candidates.length);return path.join(store,candidates[0],'node_modules',name)};
const require = createRequire(import.meta.url);
const esbuild = require(pkg('esbuild', 'esbuild'));
const WebSocket = require(pkg('ws', 'ws'));
const spawned = [];
const originalSpawn = cp.spawn;
cp.spawn = function(command, args, options) {
  const child = originalSpawn.call(this, command, args, options);
  if (String(command).includes('workerd')) spawned.push({ child, command, args });
  return child;
};
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require(pkg('miniflare', 'miniflare'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const dirs = ['fixtures','bundles','results'];
for (const d of dirs) fs.mkdirSync(path.join(here,d), {recursive:true});
const json = (name, value) => fs.writeFileSync(path.join(here,name), JSON.stringify(value,null,2)+'\n');
const slash = p => p.replaceAll('\\','/');
const sources = ['apps/image-worker/src/index.ts','apps/image-worker/src/photon.ts','apps/image-worker/src/validators.ts','apps/image-worker/src/dimensions.ts','apps/image-worker/wrangler.toml','pnpm-lock.yaml'];
const versions = Object.fromEntries(['miniflare','workerd','esbuild','ws'].map(name => [name,require(path.join(pkg(name,name),'package.json')).version]));
versions.photon = require(path.join(pkg('@cf-wasm+photon','@cf-wasm/photon'),'package.json')).version;
const provenance = { createdAt:new Date().toISOString(), root, node:process.version, versions,
  variant,scriptSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  sources:Object.fromEntries(sources.map(p => [p, hash(fs.readFileSync(path.join(root,p)))])),
  commands:process.argv, description:'Original routes/processors bundled into scratch; no source file changes; no external fixture requests.' };
provenance.photonWasmSHA256=hash(fs.readFileSync(path.join(pkg('@cf-wasm+photon','@cf-wasm/photon'),'dist/lib/photon_rs_bg.wasm')));
json('provenance'+(label?'-'+label:'')+'.json',provenance);
fs.appendFileSync(path.join(here,'commands.jsonl'),JSON.stringify({timestamp:provenance.createdAt,argv:process.argv,variant,scriptSha256:provenance.scriptSha256})+'\n');

// PNG fixture generation: real filtered scanlines, real zlib IDAT, actual CRCs.
const crcTable = new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;}
function fixture(name,depth,colorType,width=3072,height=3072,randomRows=0){
  const target=path.join(here,'fixtures',name+'.png');
  if(!fs.existsSync(target)){
    const channels=({0:1,2:3,4:2,6:4})[colorType];const stride=width*channels*(depth/8);const scan=Buffer.alloc((stride+1)*height);
    let state=0x7a6b5c4d;
    for(let y=0;y<height;y++){
      const offset=y*(stride+1)+1;
      for(let x=0;x<stride;x++){
        if(y<randomRows){state^=state<<13;state^=state>>>17;state^=state<<5;scan[offset+x]=state&255;}
        else scan[offset+x]=((x%channels)===channels-1&&colorType===6)?255:96;
      }
    }
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=depth;ihdr[9]=colorType;
    const compressed=zlib.deflateSync(scan,{level:9});
    fs.writeFileSync(target,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]));
  }
  const bytes=fs.readFileSync(target);
  return {name,path:target,bytes:bytes.length,sha256:hash(bytes),width,height,depth,colorType,randomRows,seed:randomRows?'0x7a6b5c4d':null};
}
const fixtureSet='actual';
if(process.argv.some(a=>a.startsWith('--set=')&&a!=='--set=actual'))throw new Error('Only the bounded actual-source fixture set is supported');
function paddedFixture(){
 const base=fixture('rgba8-small-padbase',8,6,64,64),bytes=fs.readFileSync(base.path),targetBytes=5*1024*1024+1;
 const data=Buffer.alloc(targetBytes-bytes.length-12,65);data.write('pad\0');
 const padded=Buffer.concat([bytes.subarray(0,33),chunk('tEXt',data),bytes.subarray(33)]);const target=path.join(here,'fixtures/rgba8-over5MiB-onebyte.png');fs.writeFileSync(target,padded);
 return {...base,name:'rgba8-over5MiB-onebyte',path:target,bytes:padded.length,sha256:hash(padded),ancillaryPaddingBytes:data.length};
}
const fixtures=[
 fixture('rgba8-64cap-near5MiB',8,6,4096,2048,309),fixture('rgba8-4K-near5MiB',8,6,3840,2160,330),
 fixture('rgba8-ultrawide-near5MiB',8,6,3440,1440,368),fixture('rgba8-smaller-near5MiB',8,6,1280,1024,990),
 fixture('rgba8-noresize',8,6,256,256),fixture('rgba8-highaspect',8,6,4096,1),
 ...[0,2,4,6].map(color=>fixture('png16-color'+color+'-64cap',16,color,4096,2048)),paddedFixture()
];
json('fixtures-'+fixtureSet+'.json',fixtures);

function replaceOnce(text,from,to){if(!text.includes(from))throw new Error('Instrumentation match missing: '+from);return text.replace(from,to);}
function instrument(text){
  text=text.replaceAll('  assertImageDimensionsFromHeader(buffer);',"  globalThis.__probe.capture('before-header-gate');\n  assertImageDimensionsFromHeader(buffer);\n  globalThis.__probe.capture('after-header-gate');");
  for(const [from,stage] of [
    ['originalImage = loadImage(buffer);','extract-after-decode'],
    ['resizedImage = resizeImage(originalImage, maxDimension, samplingFilter);','extract-after-resize'],
    ['const pixels = extractPixels(resizedImage);','extract-after-pixel-copy'],
    ['original = loadImage(buffer);','thumbnail-after-decode'],
    ['cropped = crop(original, box.x1, box.y1, box.x2, box.y2);','thumbnail-after-crop'],
    ['resized = resize(cropped, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, SamplingFilter.Lanczos3);','thumbnail-after-resize'],
  ])text=replaceOnce(text,from,from+`\n    globalThis.__probe.capture('${stage}');`);
  text=replaceOnce(text,'return resized.get_bytes_webp();',"const encoded = resized.get_bytes_webp();\n    globalThis.__probe.capture('thumbnail-after-webp');\n    return encoded;");
  return text;
}
function entry(instrumented){return `
import app from ${JSON.stringify(slash(path.join(root,'apps/image-worker/src/index.ts')))};
import {initPhoton, PhotonImage} from '@cf-wasm/photon/workerd';
const p={stage:'idle', stages:[], calls:${instrumented?'0':'null'}, memory:null, pause:false,
capture(stage){this.stage=stage;const wasmBytes=this.memory.buffer.byteLength;this.stages.push({stage,wasmBytes});${instrumented?'if(this.pause)debugger;':''}}};
globalThis.__probe=p;
${instrumented?`const original=PhotonImage.new_from_byteslice;PhotonImage.new_from_byteslice=function(...args){p.calls++;p.capture('constructor-before');try{return original.apply(this,args)}finally{p.capture('constructor-after')}};`:''}
export default {async fetch(request,env,ctx){
  p.memory=(await initPhoton.ensure()).memory;
  const url=new URL(request.url);
  if(url.pathname==='/__metrics')return Response.json({stages:p.stages,calls:p.calls,wasmBytes:p.memory.buffer.byteLength});
  if(url.pathname==='/__calibrate'){
    p.pause=true;p.capture('calibration-baseline');
    globalThis.__calibrationMemory=new WebAssembly.Memory({initial:16,maximum:1024});p.capture('calibration-1MiB');
    globalThis.__calibrationMemory.grow(128);new Uint8Array(globalThis.__calibrationMemory.buffer).fill(7);p.capture('calibration-9MiB');
    globalThis.__calibrationBuffer=new ArrayBuffer(8*1024*1024);new Uint8Array(globalThis.__calibrationBuffer).fill(9);p.capture('calibration-plus-8MiB-ArrayBuffer');
    return Response.json({calibrationBytes:globalThis.__calibrationMemory.buffer.byteLength});
  }
  p.stages=[];p.calls=${instrumented?'0':'null'};p.pause=request.headers.get('X-Probe-Pause')==='yes';p.capture('request-start');
  try{return await app.fetch(request,env,ctx)}finally{p.capture('request-finally')}
}};
`;}
async function build(instrumented){
  const name=(instrumented?'instrumented':'control')+(variant==='frozen-source'?'':'-'+variant)+(label?'-'+label:'');const outdir=path.join(here,'bundles',name);fs.mkdirSync(outdir,{recursive:true});
  const result=await esbuild.build({stdin:{contents:entry(instrumented),resolveDir:path.join(root,'apps/image-worker'),sourcefile:name+'.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',conditions:['workerd','worker','browser'],write:false,metafile:true,
    plugins:[{name:'scratch-only',setup(build){
      build.onResolve({filter:/\.wasm$/},()=>({path:'./photon.wasm',external:true}));
      if(instrumented)build.onLoad({filter:/apps[\\/]image-worker[\\/]src[\\/]photon\.ts$/},args=>({contents:instrument(fs.readFileSync(args.path,'utf8')),loader:'ts'}));
    }}]});
  fs.writeFileSync(path.join(outdir,'worker.mjs'),result.outputFiles[0].contents);
  const wasm=path.join(pkg('@cf-wasm+photon','@cf-wasm/photon'),'dist/lib/photon_rs_bg.wasm');fs.copyFileSync(wasm,path.join(outdir,'photon.wasm'));
  json('bundles/'+name+'/inputs.json',Object.fromEntries(Object.keys(result.metafile.inputs).filter(p=>fs.existsSync(path.resolve(root,p))).map(p=>[p,hash(fs.readFileSync(path.resolve(root,p)))])));
  return outdir;
}
const bundles={control:await build(false),instrumented:await build(true)};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function osMemory(pid){
  return new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$probeProcess=Get-Process -Id ${pid} -ErrorAction Stop; $probeProcess.Refresh(); [PSCustomObject]@{pid=$probeProcess.Id;peakWorkingSet64=$probeProcess.PeakWorkingSet64;workingSet64=$probeProcess.WorkingSet64;privateMemorySize64=$probeProcess.PrivateMemorySize64} | ConvertTo-Json -Compress`],{windowsHide:true,timeout:10000},(e,out)=>{if(e)reject(e);else resolve(JSON.parse(out));}));
}
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.samples=[];this.work=Promise.resolve();ws.on('message',data=>{const msg=JSON.parse(String(data));if(msg.id){const p=this.pending.get(msg.id);if(p){this.pending.delete(msg.id);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}
    if(msg.method==='Debugger.paused')this.work=this.work.then(async()=>{try{
      const heap=await this.send('Runtime.getHeapUsage');
      const state=await this.send('Debugger.evaluateOnCallFrame',{callFrameId:msg.params.callFrames[0].callFrameId,expression:'({stage:globalThis.__probe.stage,wasmBytes:globalThis.__probe.memory.buffer.byteLength,calibrationBytes:globalThis.__calibrationMemory?.buffer.byteLength??0})',returnByValue:true});
      this.samples.push({...state.result.value,...heap});
    }catch(error){this.samples.push({error:String(error)});}finally{await this.send('Debugger.resume');}});
  });}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);this.pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});this.ws.send(JSON.stringify({id,method,params}));});}
  async close(){await this.work;this.ws.close();}
}
async function connect(mf,enableDebugger=true){
  const url=await mf.getInspectorURL();const discovery=new URL('/json/list',url);discovery.protocol='http:';console.log('Inspector discovery '+discovery);let list;try{list=await (await fetch(discovery)).json()}catch(e){throw new Error('Inspector discovery failed: '+discovery+' '+String(e.cause),{cause:e})}
  const target=list.find(x=>x.title.includes('image-probe'))??list.at(-1);
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
  const cdp=new CDP(ws);await cdp.send('Runtime.enable');if(enableDebugger)await cdp.send('Debugger.enable');return cdp;
}
async function runCase(fixture,flow,mode,options={}){
  const id=`${fixture?.name??'calibration'}-${flow}-${mode}`+(variant==='frozen-source'?'':'-'+variant)+(label?'-'+label:'');const bytes=fixture?fs.readFileSync(fixture.path):null;
  const beforeSpawn=spawned.length;let mf,cdp,outboundFetches=0;const result={id,fixture:fixture?.name,flow,mode,variant,label,sourceRoot:root,sourceHashes:provenance.sources,cf:false,telemetry:false,startedAt:new Date().toISOString(),sourceHead:provenance.head};
  try{
    const dir=bundles[mode];const mfOptions=convertV4MiniflareOptions({name:'image-probe',host:'127.0.0.1',port:0,cf:false,...(mode==='instrumented'?{inspectorPort:0}:{}),compatibilityDate:'2024-12-01',modules:[{type:'ESModule',path:path.join(dir,'worker.mjs')},{type:'CompiledWasm',path:path.join(dir,'photon.wasm')}],
      log:new Log(LogLevel.ERROR),outboundService:async request=>{
        if(!fixture||new URL(request.url).hostname!=='cdn.discordapp.com')throw new Error('Unexpected external URL: '+request.url);
        outboundFetches++;
        return new Response(bytes,{headers:{'Content-Type':'image/png','Content-Length':String(bytes.length)}});
      }});mfOptions.resourceTmpPath=path.join(here,'runtime-tmp');mfOptions.resourcePersistencePath=path.join(here,'runtime-persist');mfOptions.telemetry={enabled:false};mf=new Miniflare(mfOptions);
    await mf.ready;
    const runtime=spawned.slice(beforeSpawn).at(-1);if(!runtime)throw new Error('workerd child not captured');
    result.workerd={pid:runtime.child.pid,command:runtime.command,args:runtime.args};
    result.osBefore=await osMemory(runtime.child.pid);
    if(mode==='instrumented')cdp=await connect(mf);
    result.initialHeap=cdp?await cdp.send('Runtime.getHeapUsage'):null;
    const start=performance.now();
    let response;
    if(flow==='calibration')response=await mf.dispatchFetch('https://image-worker/__calibrate');
    else if(flow==='thumbnail'){
      const requestOptions={method:'POST',body:bytes,headers:{'X-Probe-Pause':mode==='instrumented'?'yes':'no','Content-Length':String(bytes.length)},signal:AbortSignal.timeout(60000)};
      if(fixture.name==='rgba8-over5MiB-onebyte'){result.transport='service-binding-proxy';const bound=await mf.getWorker('image-probe');response=await bound.fetch('https://image-worker/thumbnail',requestOptions)}
      else response=await mf.dispatchFetch('https://image-worker/thumbnail',requestOptions);
    }
    else response=await mf.dispatchFetch('https://image-worker/extract',{method:'POST',body:JSON.stringify({url:'https://cdn.discordapp.com/fixture.png',...(flow!=='extract256'?{maxDimension:Number(flow.slice(7))}:{})}),headers:{'Content-Type':'application/json','X-Probe-Pause':mode==='instrumented'?'yes':'no'},signal:AbortSignal.timeout(60000)});
    const out=new Uint8Array(await response.arrayBuffer());
    result.response={status:response.status,bytes:out.length,sha256:hash(out),headers:Object.fromEntries(response.headers),error:response.ok?undefined:new TextDecoder().decode(out)};
    result.durationMs=performance.now()-start;
    result.finalHeap=cdp?await cdp.send('Runtime.getHeapUsage'):null;
    result.metrics=await (await mf.dispatchFetch('https://image-worker/__metrics')).json();
    result.outboundFetches=outboundFetches;
    if(cdp)await cdp.work;result.samples=cdp?cdp.samples:[];
    result.osAfter=await osMemory(runtime.child.pid);
    result.wasmHighWaterBytes=Math.max(result.metrics.wasmBytes,...result.metrics.stages.map(s=>s.wasmBytes));
    result.stagedHeapPlusExternalMaxBytes=result.samples.length?Math.max(...result.samples.filter(s=>!s.error).map(s=>s.totalSize+s.backingStorageSize)):null;
    result.stagedFieldMaxima=Object.fromEntries(['usedSize','totalSize','backingStorageSize','embedderHeapUsedSize'].map(field=>[field,result.samples.length&&result.samples.every(s=>Number.isFinite(s[field]))?Math.max(...result.samples.map(s=>s[field])):null]));
    console.log(JSON.stringify({id,status:result.response.status,wasmMiB:result.wasmHighWaterBytes/1048576,stagedTotalExternalMiB:result.stagedHeapPlusExternalMaxBytes/1048576,processPeakMiB:result.osAfter.peakWorkingSet64/1048576,responseBytes:out.length,durationMs:result.durationMs}));
  }catch(error){result.failure=String(error.stack??error);console.error(id,result.failure);}
  finally{if(cdp)await cdp.close().catch(()=>{});if(mf)await mf.dispose().catch(()=>{});json('results/'+id+'.json',result);}
  return result;
}
const filter=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const results=[];
if(!process.argv.includes('--warm-only')){
 if(process.argv.includes('--calibrate'))results.push(await runCase(null,'calibration','instrumented'));
 const specs=[
  ...['extract256','extract512','thumbnail'].map(flow=>[fixtures[0],flow,['instrumented','control']]),
  ...['extract256','thumbnail'].map(flow=>[fixtures[1],flow,['instrumented','control']]),
  ...['extract256','extract512'].map(flow=>[fixtures[4],flow,['instrumented','control']]),
  ...['extract512','thumbnail'].map(flow=>[fixtures[5],flow,['instrumented','control']]),
  ...fixtures.slice(6,11).flatMap(f=>['extract256','thumbnail'].map(flow=>[f,flow,['instrumented']])),
  [fixtures[0],'extract513',['instrumented']],
 ];
 for(const [f,flow,modes]of specs)for(const mode of modes){
   const id=`${f.name}-${flow}-${mode}`;
   if(filter&&!filter.split(',').some(part=>id.includes(part)))continue;
   results.push(await runCase(f,flow,mode));
 }
}
async function runWarm(mode){
 const id='warm-mixed-'+mode+(label?'-'+label:'');const record={id,mode,sourceHead:provenance.head,sourceHashes:provenance.sources,variant,cf:false,telemetry:false,rounds:3,cases:[],fixtureRefs:fixtures.slice(0,4)};
 let mf,cdp,activeBytes=null;const beforeSpawn=spawned.length;
 try{
  const dir=bundles[mode==='runtime-only'?'control':mode];const opts=convertV4MiniflareOptions({name:'image-probe',host:'127.0.0.1',port:0,cf:false,...(mode==='instrumented'||mode==='runtime-only'?{inspectorPort:0}:{}),compatibilityDate:'2024-12-01',modules:[{type:'ESModule',path:path.join(dir,'worker.mjs')},{type:'CompiledWasm',path:path.join(dir,'photon.wasm')}],log:new Log(LogLevel.ERROR),outboundService:async request=>{if(!activeBytes||new URL(request.url).hostname!=='cdn.discordapp.com')throw new Error('Unexpected external URL');return new Response(activeBytes,{headers:{'Content-Type':'image/png','Content-Length':String(activeBytes.length)}})}});
  opts.resourceTmpPath=path.join(here,'runtime-tmp');opts.resourcePersistencePath=path.join(here,'runtime-persist');opts.telemetry={enabled:false};mf=new Miniflare(opts);await mf.ready;
  const runtime=spawned.slice(beforeSpawn).at(-1);if(!runtime)throw new Error('workerd child missing');record.workerd={pid:runtime.child.pid,command:runtime.command,args:runtime.args};record.osBefore=await osMemory(runtime.child.pid);
  if(mode==='instrumented'||mode==='runtime-only')cdp=await connect(mf,mode==='instrumented');
  const idleSample=async()=>{let discardConsoleEntries;try{await cdp.send('Runtime.discardConsoleEntries');discardConsoleEntries={ok:true}}catch(error){discardConsoleEntries={ok:false,error:String(error)}}return{discardConsoleEntries,heap:await cdp.send('Runtime.getHeapUsage')}};
  const sequence=[[fixtures[0],'extract512'],[fixtures[1],'thumbnail'],[fixtures[2],'extract512'],[fixtures[3],'thumbnail'],[fixtures[0],'thumbnail'],[fixtures[1],'extract256']];
  for(let round=1;round<=3;round++)for(const [f,flow]of sequence){
   activeBytes=fs.readFileSync(f.path);const step={index:record.cases.length+1,round,fixture:f.name,flow};const prior=await(await mf.dispatchFetch('https://image-worker/__metrics')).json();step.wasmBeforeBytes=prior.wasmBytes;if(mode==='runtime-only')step.idleBefore=await idleSample();const sampleStart=cdp?.samples.length??0;
   const headers={'X-Probe-Pause':mode==='instrumented'?'yes':'no'};const start=performance.now();
   let response=flow==='thumbnail'?await mf.dispatchFetch('https://image-worker/thumbnail',{method:'POST',body:activeBytes,headers:{...headers,'Content-Length':String(activeBytes.length)},signal:AbortSignal.timeout(60000)}):await mf.dispatchFetch('https://image-worker/extract',{method:'POST',body:JSON.stringify({url:'https://cdn.discordapp.com/fixture.png',...(flow==='extract512'?{maxDimension:512}:{})}),headers:{...headers,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000)});
   let output=new Uint8Array(await response.arrayBuffer());step.status=response.status;step.responseBytes=output.length;step.responseSHA256=hash(output);step.durationMs=performance.now()-start;
   output=null;response=null;activeBytes=null;
   step.metrics=await(await mf.dispatchFetch('https://image-worker/__metrics')).json();if(cdp)await cdp.work;step.samples=cdp?cdp.samples.slice(sampleStart):[];
   if(mode==='runtime-only')step.idleAfter=await idleSample();
   step.wasmAfterBytes=step.metrics.wasmBytes;record.cases.push(step);
   json('results/'+id+'.json',record);
   console.log(JSON.stringify({id,index:step.index,round,fixture:f.name,flow,status:step.status,wasmBeforeMiB:step.wasmBeforeBytes/1048576,wasmAfterMiB:step.wasmAfterBytes/1048576,stagedUsedMaxMiB:step.samples.length?Math.max(...step.samples.map(s=>s.usedSize))/1048576:null,stagedExternalMaxMiB:step.samples.length?Math.max(...step.samples.map(s=>s.backingStorageSize))/1048576:null,idleUsedMiB:step.idleAfter?step.idleAfter.heap.usedSize/1048576:null,idleExternalMiB:step.idleAfter?step.idleAfter.heap.backingStorageSize/1048576:null}));
  }
  record.osAfter=await osMemory(runtime.child.pid);record.wasmHighWaterBytes=Math.max(...record.cases.map(c=>c.wasmAfterBytes));record.finalHeap=cdp?await cdp.send('Runtime.getHeapUsage'):null;
  if(mode==='runtime-only'&&process.argv.includes('--diagnostic-gc-at-end')){
   record.forcedGCDiagnostic={label:'Idle after complete18request sequence only; diagnostic reachability experiment, not production behavior or pass criterion',before:await idleSample(),wasmBeforeBytes:(await(await mf.dispatchFetch('https://image-worker/__metrics')).json()).wasmBytes};
   await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.collectGarbage');record.forcedGCDiagnostic.collectGarbage={ok:true};
   record.forcedGCDiagnostic.after=await idleSample();record.forcedGCDiagnostic.wasmAfterBytes=(await(await mf.dispatchFetch('https://image-worker/__metrics')).json()).wasmBytes;
   console.log(JSON.stringify({id,forcedGCDiagnostic:record.forcedGCDiagnostic}));
  }
 }catch(error){record.failure=String(error.stack??error);console.error(id,record.failure)}finally{activeBytes=null;if(cdp)await cdp.close().catch(()=>{});if(mf)await mf.dispose().catch(()=>{});json('results/'+id+'.json',record)}
 return record;
}
if(process.argv.includes('--warm')||process.argv.includes('--warm-only')){
 if(fixtureSet!=='actual')throw new Error('Warm sequence requires --set=actual');
 if(process.argv.includes('--runtime-only-diagnostic'))results.push(await runWarm('runtime-only'));
 else{results.push(await runWarm('instrumented'));results.push(await runWarm('control'));}
}
if (!results.length) throw new Error('No measurement cases matched; check --only and mode flags.');
json('summary-'+fixtureSet+(filter?'-'+filter.replaceAll(',','_'):'')+(variant==='frozen-source'?'':'-'+variant)+(label?'-'+label:'')+'.json',{provenance,fixtures,results});
const after=Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]));
json('source-integrity'+(label?'-'+label:'')+'.json',{unchanged:JSON.stringify(after)===JSON.stringify(provenance.sources),before:provenance.sources,after});
if(results.some(r=>r.failure))process.exitCode=1;
