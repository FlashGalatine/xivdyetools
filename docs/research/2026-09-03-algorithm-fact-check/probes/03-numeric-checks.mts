import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';
import { RybColorMixer } from '../../../../packages/core/src/services/color/RybColorMixer.ts';
import { rgbToLab as blendRgbToLab, rgbToRyb as bRgbToRyb, rybToRgb as bRybToRgb } from '../../../../packages/core/src/blending/conversions.ts';
import dyes from '../../../../packages/core/src/data/dyes.json' with { type: 'json' };

const hexes: string[] = (dyes as any[]).map(d => d.hex);
console.log(`dyes loaded: ${hexes.length}`);

// ---- 1. kappa rounding: 903.3 vs 24389/27 ----
const KAPPA_EXACT = 24389/27, EPS_EXACT = 216/24389;
function fExact(t:number){ return t > EPS_EXACT ? Math.cbrt(t) : (KAPPA_EXACT*t + 16)/116; }
function fRepo(t:number){ return t > 0.008856 ? Math.pow(t,1/3) : (903.3*t + 16)/116; }
let maxFDiff = 0, worstT = 0;
for (let i=0;i<=100000;i++){ const t=i/100000*0.02; const d=Math.abs(fExact(t)-fRepo(t)); if(d>maxFDiff){maxFDiff=d;worstT=t;} }
console.log(`\n1) CIELAB f(t): repo(eps=0.008856,kappa=903.3) vs exact(216/24389, 24389/27)`);
console.log(`   max |Δf| over t∈[0,0.02] = ${maxFDiff.toExponential(3)} at t=${worstT.toExponential(3)}`);
console.log(`   => max ΔL* ≈ ${(116*maxFDiff).toExponential(3)}, max Δa* ≈ ${(500*maxFDiff).toExponential(3)}`);
console.log(`   eps exact = ${EPS_EXACT.toPrecision(12)} (repo 0.008856), kappa exact = ${KAPPA_EXACT.toPrecision(12)} (repo 903.3)`);

// ---- 2. ColorConverter.rgbToLab (rounded 4dp) vs blending/conversions.rgbToLab ----
let maxLabDiff = 0, worstHex = '';
for (const h of hexes) {
  const rgb = ColorConverter.hexToRgb(h);
  const a = ColorConverter.rgbToLab(rgb.r, rgb.g, rgb.b);
  const b = blendRgbToLab(rgb);
  const d = Math.max(Math.abs(a.L-b.l), Math.abs(a.a-b.a), Math.abs(a.b-b.b));
  if (d > maxLabDiff) { maxLabDiff = d; worstHex = h; }
}
console.log(`\n2) ColorConverter.rgbToLab vs blending/conversions.rgbToLab over ${hexes.length} dyes`);
console.log(`   max per-component |Δ| = ${maxLabDiff.toExponential(3)} (worst ${worstHex})`);

// ---- 3. Oklch-weighted hue term vs proper deltaH ----
console.log(`\n3) getDeltaE_OklchWeighted hue term vs standard dH = 2*sqrt(C1*C2)*sin(dh/2)`);
console.log(`   dh(deg)   repo:(dh/180)*Cbar   proper:2*sqrt(C1C2)sin(dh/2)   ratio(proper/repo)`);
for (const dh of [1,5,10,30,60,90,120,180]) {
  const C = 0.15; // typical Oklch chroma
  const repo = (dh/180)*C;
  const proper = 2*C*Math.sin(dh*Math.PI/360);
  console.log(`   ${String(dh).padStart(5)}     ${repo.toFixed(6)}             ${proper.toFixed(6)}                    ${(proper/repo).toFixed(4)}`);
}
console.log(`   (pi = ${Math.PI.toFixed(4)} — the small-angle ratio)`);

// ---- 4. RYB implementations: round-trip fidelity + disagreement ----
console.log(`\n4) RYB implementations over ${hexes.length} dyes`);
let gcMax=0,gcSum=0,gcWorst='', chMax=0,chSum=0,chWorst='';
for (const h of hexes) {
  const rgb = ColorConverter.hexToRgb(h);
  // Gossett-Chen path (RybColorMixer)
  const ryb1 = RybColorMixer.rgbToRyb(rgb.r,rgb.g,rgb.b);
  const back1 = RybColorMixer.rybToRgb(ryb1.r,ryb1.y,ryb1.b);
  const d1 = ColorConverter.getDeltaE2000(ColorConverter.rgbToLab(rgb.r,rgb.g,rgb.b), ColorConverter.rgbToLab(back1.r,back1.g,back1.b));
  gcSum+=d1; if(d1>gcMax){gcMax=d1;gcWorst=h;}
  // chromatic-subtraction path (blending/conversions)
  const ryb2 = bRgbToRyb(rgb);
  const back2 = bRybToRgb(ryb2);
  const d2 = ColorConverter.getDeltaE2000(ColorConverter.rgbToLab(rgb.r,rgb.g,rgb.b), ColorConverter.rgbToLab(back2.r,back2.g,back2.b));
  chSum+=d2; if(d2>chMax){chMax=d2;chWorst=h;}
}
console.log(`   Gossett-Chen (RybColorMixer)      round-trip dE00: mean ${(gcSum/hexes.length).toFixed(2)}, max ${gcMax.toFixed(2)} (${gcWorst})`);
console.log(`   chromatic-subtraction (blending)  round-trip dE00: mean ${(chSum/hexes.length).toFixed(2)}, max ${chMax.toFixed(2)} (${chWorst})`);

// ---- 5. how often do matching methods disagree on the closest dye? ----
console.log(`\n5) matching-method disagreement on nearest dye (1000 random sRGB queries)`);
const methods = ['ciede2000','cie76','oklab'] as const;
function nearest(hex:string, m:'ciede2000'|'cie76'|'oklab'|'rgb'|'redmean'){
  let best='',bd=Infinity;
  for (const h of hexes){
    const d = m==='rgb' ? ColorConverter.getColorDistance(hex,h)
            : m==='redmean' ? ColorConverter.getRedmeanDistance(hex,h)
            : ColorConverter.getDeltaE(hex,h,m);
    if(d<bd){bd=d;best=h;}
  }
  return best;
}
let seed=42; const rnd=()=> (seed = (seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
const counts: Record<string,number> = {};
const N=1000;
for(let i=0;i<N;i++){
  const hex = '#'+[0,1,2].map(()=>Math.floor(rnd()*256).toString(16).padStart(2,'0')).join('');
  const ref = nearest(hex,'ciede2000');
  for (const m of ['cie76','oklab','rgb','redmean'] as const){
    if (nearest(hex,m)!==ref) counts[m]=(counts[m]??0)+1;
  }
}
for (const m of ['cie76','oklab','rgb','redmean']) {
  console.log(`   ${m.padEnd(10)} picks a different dye than ciede2000 in ${((counts[m]??0)/N*100).toFixed(1)}% of queries`);
}
