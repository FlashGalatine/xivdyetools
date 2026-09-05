#!/usr/bin/env node
/* Round 2: add an OKLCH-derived HUE-WARP wheel (keeps base S/V) and target-distance breakdowns. */
import { readFileSync } from 'node:fs';
const DYES_PATH = new URL('../../../../packages/core/src/data/dyes.json', import.meta.url);

const hexToRgb = (hex) => { const h = hex.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
const c255 = (x) => Math.max(0, Math.min(255, Math.round(x)));
const rgbToHex = (r,g,b) => '#' + [r,g,b].map(v=>c255(v).toString(16).padStart(2,'0')).join('');
function rgbToHsv(r,g,b){const rr=r/255,gg=g/255,bb=b/255;const max=Math.max(rr,gg,bb),min=Math.min(rr,gg,bb),d=max-min;let h=0;if(d!==0){if(max===rr)h=((gg-bb)/d)%6;else if(max===gg)h=(bb-rr)/d+2;else h=(rr-gg)/d+4;h*=60;if(h<0)h+=360;}return{h,s:max===0?0:(d/max)*100,v:max*100};}
function hsvToRgb(h,s,v){const S=s/100,V=v/100;const c=V*S,x=c*(1-Math.abs(((h/60)%2)-1)),m=V-c;let r=0,g=0,b=0;if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255];}
const hexToHsv=(hex)=>rgbToHsv(...hexToRgb(hex));
const hsvToHex=(h,s,v)=>rgbToHex(...hsvToRgb(((h%360)+360)%360,s,v));
const srgbToLinear=(c)=>{const cc=c/255;return cc<=0.04045?cc/12.92:Math.pow((cc+0.055)/1.055,2.4);};
const linearToSrgb=(c)=>255*(c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055);
function rgbToLab(r,g,b){const R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);let X=R*0.4124564+G*0.3575761+B*0.1804375,Y=R*0.2126729+G*0.7151522+B*0.072175,Z=R*0.0193339+G*0.119192+B*0.9503041;X/=0.95047;Z/=1.08883;const f=(t)=>t>0.008856?Math.cbrt(t):7.787*t+16/116;const fx=f(X),fy=f(Y),fz=f(Z);return[116*fy-16,500*(fx-fy),200*(fy-fz)];}
const hexToLab=(hex)=>rgbToLab(...hexToRgb(hex));
function ciede2000(l1,l2){const[L1,a1,b1]=l1,[L2,a2,b2]=l2;const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2);const Cbar=(C1+C2)/2,C7=Math.pow(Cbar,7);const G=0.5*(1-Math.sqrt(C7/(C7+Math.pow(25,7))));const a1p=(1+G)*a1,a2p=(1+G)*a2;const C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);const deg=(r)=>r*180/Math.PI,rad=(d)=>d*Math.PI/180;const hp=(ap,bp)=>{if(ap===0&&bp===0)return 0;let h=deg(Math.atan2(bp,ap));if(h<0)h+=360;return h;};const h1p=hp(a1p,b1),h2p=hp(a2p,b2);const dLp=L2-L1,dCp=C2p-C1p;let dhp;if(C1p*C2p===0)dhp=0;else{dhp=h2p-h1p;if(dhp>180)dhp-=360;else if(dhp<-180)dhp+=360;}const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(rad(dhp/2));const Lbp=(L1+L2)/2,Cbp=(C1p+C2p)/2;let hbp;if(C1p*C2p===0)hbp=h1p+h2p;else{const d=Math.abs(h1p-h2p),s=h1p+h2p;hbp=d<=180?s/2:(s<360?(s+360)/2:(s-360)/2);}const T=1-0.17*Math.cos(rad(hbp-30))+0.24*Math.cos(rad(2*hbp))+0.32*Math.cos(rad(3*hbp+6))-0.2*Math.cos(rad(4*hbp-63));const dTheta=30*Math.exp(-Math.pow((hbp-275)/25,2));const Cbp7=Math.pow(Cbp,7);const Rc=2*Math.sqrt(Cbp7/(Cbp7+Math.pow(25,7)));const Sl=1+(0.015*Math.pow(Lbp-50,2))/Math.sqrt(20+Math.pow(Lbp-50,2));const Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T;const Rt=-Math.sin(rad(2*dTheta))*Rc;return Math.sqrt(Math.pow(dLp/Sl,2)+Math.pow(dCp/Sc,2)+Math.pow(dHp/Sh,2)+Rt*(dCp/Sc)*(dHp/Sh));}
function rgbToOklab(r,g,b){const R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B);const m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B);const s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);return[0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s];}
function oklabToLin(L,a,b){const l=Math.pow(L+0.3963377774*a+0.2158037573*b,3);const m=Math.pow(L-0.1055613458*a-0.0638541728*b,3);const s=Math.pow(L-0.0894841775*a-1.291485548*b,3);return[4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.707614701*s];}
const inGamut=(lin,eps=1/512)=>lin.every((c)=>c>=-eps&&c<=1+eps);
const oklabToHexClip=(L,a,b)=>rgbToHex(...oklabToLin(L,a,b).map((c)=>linearToSrgb(Math.max(0,Math.min(1,c)))));
const deltaEOK=(o1,o2)=>Math.hypot(o1[0]-o2[0],o1[1]-o2[1],o1[2]-o2[2]);
function oklchToHexCss4(L,C,h){const hr=h*Math.PI/180;const lab=(c)=>[L,c*Math.cos(hr),c*Math.sin(hr)];if(L>=1)return'#ffffff';if(L<=0)return'#000000';if(inGamut(oklabToLin(...lab(C))))return oklabToHexClip(...lab(C));let lo=0,hi=C;while(hi-lo>0.0001){const mid=(lo+hi)/2,cand=lab(mid);if(inGamut(oklabToLin(...cand)))lo=mid;else{const ch=oklabToHexClip(...cand);if(deltaEOK(rgbToOklab(...hexToRgb(ch)),cand)<0.02)return ch;hi=mid;}}return oklabToHexClip(...lab(lo));}

// ---- RYB warp ----
const RYB=[[0,0],[15,8],[30,17],[45,26],[60,34],[75,41],[90,48],[105,54],[120,60],[135,81],[150,103],[165,123],[180,138],[195,155],[210,171],[225,187],[240,204],[255,219],[270,234],[285,251],[300,267],[315,282],[330,298],[345,329],[360,360]];
const interp=(tbl,v,from,to)=>{v=((v%360)+360)%360;for(let i=0;i<tbl.length-1;i++){const a=tbl[i],b=tbl[i+1];if(v>=a[from]&&v<=b[from])return(a[to]+((b[to]-a[to])*(v-a[from]))/(b[from]-a[from]))%360;}return v;};
const rgbHueToRyb=(h)=>interp(RYB,h,1,0);
const rybToRgbHue=(a)=>interp(RYB,a,0,1);

// ---- OKLCH-derived hue-warp table: HSV hue -> OKLCH hue of the pure hue ----
const OKW=[];
for(let h=0;h<=360;h+=1){const ok=rgbToOklab(...hsvToRgb(h%360,100,100));let H=Math.atan2(ok[2],ok[1])*180/Math.PI;if(H<0)H+=360;OKW.push([h,H]);}
// unwrap the OKLCH column so it is monotonically increasing over 0..360+
let base=OKW[0][1];const OKT=[];let acc=0,prev=OKW[0][1];
for(const [h,H] of OKW){let v=H;while(v<prev-180)v+=360;while(v>prev+180)v-=360;acc+=0;prev=v;OKT.push([h,v]);}
const shift=OKT[0][1];
const OKTn=OKT.map(([h,v])=>[h,v-shift]); // wheel angle 0 == HSV 0 (red)
const okMono=OKTn.every((p,i)=>i===0||p[1]>=OKTn[i-1][1]-1e-9);
const okSpan=OKTn[OKTn.length-1][1];
const hsvToOkWheel=(h)=>{h=((h%360)+360)%360;const i=Math.floor(h);const a=OKTn[i],b=OKTn[i+1];return((a[1]+(b[1]-a[1])*(h-i))%360+360)%360;};
const okWheelToHsv=(a)=>{a=((a%360)+360)%360;for(let i=0;i<OKTn.length-1;i++){const p=OKTn[i],q=OKTn[i+1];if(a>=p[1]&&a<=q[1])return p[0]+((q[0]-p[0])*(a-p[1]))/(q[1]-p[1]);}return a;};

// ---- data ----
const raw=JSON.parse(readFileSync(DYES_PATH,'utf8'));
const list=Array.isArray(raw)?raw:(raw.dyes||Object.values(raw));
const dyes=list.filter((d)=>d&&d.hex&&d.category!=='Facewear').map((d)=>({id:d.stainID,name:d.name?.en??d.name,hex:'#'+String(d.hex).replace('#','').toLowerCase()}));
const labOf=new Map(dyes.map((d)=>[d.id,hexToLab(d.hex)]));
function nearest(t,ex){const tl=hexToLab(t);let best=null,bd=Infinity;for(const d of dyes){if(d.id===ex)continue;const dist=ciede2000(tl,labOf.get(d.id));if(dist<bd){bd=dist;best=d;}}return best;}

const H={complementary:[180],analogous:[30,330],triadic:[120,240]};
function target(wheel,hex,off){const hsv=hexToHsv(hex);
  if(wheel==='rgb')return hsvToHex(hsv.h+off,hsv.s,hsv.v);
  if(wheel==='ryb')return hsvToHex(rybToRgbHue(rgbHueToRyb(hsv.h)+off),hsv.s,hsv.v);
  if(wheel==='oklch-warp')return hsvToHex(okWheelToHsv(hsvToOkWheel(hsv.h)+off),hsv.s,hsv.v);
  const ok=rgbToOklab(...hexToRgb(hex));const L=ok[0],C=Math.hypot(ok[1],ok[2]);let Hh=Math.atan2(ok[2],ok[1])*180/Math.PI;if(Hh<0)Hh+=360;
  return oklchToHexCss4(L,C,Hh+off);}

console.log(`OKLCH warp table: monotonic=${okMono} span=${okSpan.toFixed(2)}°`);
console.log('  HSV->OKwheel: '+[0,30,60,120,180,240,300].map(h=>`${h}->${hsvToOkWheel(h).toFixed(1)}`).join('  '));
console.log('  OKwheel complement of red = HSV '+okWheelToHsv(hsvToOkWheel(0)+180).toFixed(1)+'; RGB wheel gives 180; RYB gives '+rybToRgbHue(rgbHueToRyb(0)+180).toFixed(1));
let rt=0;for(let i=0;i<3600;i++){const h=i/10;const b=okWheelToHsv(hsvToOkWheel(h));rt=Math.max(rt,Math.min(Math.abs(b-h),360-Math.abs(b-h)));}
console.log(`  OKLCH warp round-trip max error ${rt.toExponential(2)}°`);

const WH=['ryb','oklch-warp','oklch-full'];
console.log('\n| harmony | wheel | slots | partner changed | mean ΔE00(target moved) | mean |Δhue(target)| |');
console.log('|---|---|---|---|---|---|');
const agg={};for(const w of WH)agg[w]={c:0,t:0};
for(const [hn,offs] of Object.entries(H)){
  for(const w of WH){let c=0,t=0,sd=0,sh=0;
    for(const b of dyes)for(const o of offs){
      const t0=target('rgb',b.hex,o),t1=target(w,b.hex,o);
      const p0=nearest(t0,b.id),p1=nearest(t1,b.id);
      t++;sd+=ciede2000(hexToLab(t0),hexToLab(t1));
      const dh=Math.abs(hexToHsv(t1).h-hexToHsv(t0).h);sh+=Math.min(dh,360-dh);
      if(p0.id!==p1.id)c++;
    }
    agg[w].c+=c;agg[w].t+=t;
    console.log(`| ${hn} | ${w} | ${t} | ${c} (${(100*c/t).toFixed(1)}%) | ${(sd/t).toFixed(2)} | ${(sh/t).toFixed(1)}° |`);
  }
}
console.log('');
for(const w of WH)console.log(`ALL (${w}): ${agg[w].c}/${agg[w].t} = ${(100*agg[w].c/agg[w].t).toFixed(1)}%`);

// how many DISTINCT dyes are reachable as a complementary partner under each wheel
console.log('');
for(const w of ['rgb',...WH]){const s=new Set();for(const b of dyes)s.add(nearest(target(w,b.hex,180),b.id).id);console.log(`distinct complementary partners under ${w}: ${s.size}/125`);}
