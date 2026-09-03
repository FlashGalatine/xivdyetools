import { ColorService } from '../../../../packages/core/src/services/ColorService.ts';
import { blendColors } from '../../../../packages/core/src/blending/blending.ts';
import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';
import dyes from '../../../../packages/core/src/data/dyes.json' with { type: 'json' };
const hexes: string[] = (dyes as any[]).map(d => d.hex);
const dE=(a:string,b:string)=>ColorConverter.getDeltaE2000(ColorConverter.hexToLab(a),ColorConverter.hexToLab(b));

console.log('IDENTITY LAW: mix(A,B,0) must == A  and  mix(A,B,1) must == B\n');

const webModes = {
  rgb: (a:string,b:string,r:number)=>ColorService.mixColorsRgb(a,b,r), lab: (a:string,b:string,r:number)=>ColorService.mixColorsLab(a,b,r), oklab: (a:string,b:string,r:number)=>ColorService.mixColorsOklab(a,b,r),
  ryb: (a:string,b:string,r:number)=>ColorService.mixColorsRyb(a,b,r), hsl: (a:string,b:string,r:number)=>ColorService.mixColorsHsl(a,b,r), spectral: (a:string,b:string,r:number)=>ColorService.mixColorsSpectral(a,b,r),
} as any;

console.log('--- WEB path (ColorService) ---');
for (const m of Object.keys(webModes)) {
  let worst=0, worstCase='', fails=0, n=0;
  for (const a of hexes) for (const b of hexes.slice(0,20)) {
    n++;
    const d0=dE(webModes[m](a,b,0), a), d1=dE(webModes[m](a,b,1), b);
    const d=Math.max(d0,d1);
    if (d>0.5) fails++;
    if (d>worst){worst=d;worstCase=`${a}/${b}`;}
  }
  console.log(`  ${m.padEnd(9)} violations(dE>0.5): ${String(fails).padStart(5)}/${n}  max dE00 ${worst.toFixed(2)} (${worstCase})`);
}

console.log('\n--- BOT path (core/blending blendColors) ---');
for (const m of ['rgb','lab','oklab','ryb','hsl','spectral']) {
  let worst=0, worstCase='', fails=0, n=0;
  for (const a of hexes) for (const b of hexes.slice(0,20)) {
    n++;
    const d0=dE(blendColors(a,b,m as any,0).hex, a), d1=dE(blendColors(a,b,m as any,1).hex, b);
    const d=Math.max(d0,d1);
    if (d>0.5) fails++;
    if (d>worst){worst=d;worstCase=`${a}/${b}`;}
  }
  console.log(`  ${m.padEnd(9)} violations(dE>0.5): ${String(fails).padStart(5)}/${n}  max dE00 ${worst.toFixed(2)} (${worstCase})`);
}

console.log('\nCOMMUTATIVITY: mix(A,B,0.5) must == mix(B,A,0.5)');
for (const m of ['rgb','lab','oklab','ryb','hsl','spectral']) {
  let worst=0, fails=0, n=0, wc='';
  for (const a of hexes.slice(0,40)) for (const b of hexes.slice(0,40)) {
    n++;
    const d = dE(blendColors(a,b,m as any,0.5).hex, blendColors(b,a,m as any,0.5).hex);
    if (d>0.5) fails++;
    if (d>worst){worst=d;wc=`${a}/${b}`;}
  }
  console.log(`  bot ${m.padEnd(9)} violations: ${String(fails).padStart(5)}/${n}  max dE00 ${worst.toFixed(2)} (${wc})`);
}

console.log('\nWORKED EXAMPLE — web RYB endpoint failure:');
for (const [a,b] of [['#49f8fd','#000000'],['#FFFFFF','#000000'],['#3B5998','#E8B923']] as const) {
  console.log(`  mixColorsRyb('${a}','${b}', 0) = ${ColorService.mixColorsRyb(a,b,0)}   (expected ${a}, dE00 ${dE(ColorService.mixColorsRyb(a,b,0),a).toFixed(1)})`);
}
