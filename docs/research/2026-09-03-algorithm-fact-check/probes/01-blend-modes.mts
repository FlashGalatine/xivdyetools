import { blendColors } from '../../../../packages/core/src/blending/blending.ts';
import { reflectanceToKS, ksToReflectance } from '../../../../packages/core/src/blending/conversions.ts';

const pairs: Array<[string,string,string]> = [
  ['#0000FF','#FFFF00','blue + yellow  (KM classic: should be GREEN)'],
  ['#FF0000','#FFFF00','red + yellow   (should be ORANGE)'],
  ['#FFFFFF','#FF0000','white + red    (should be PINK)'],
  ['#0000FF','#FF0000','blue + red     (should be PURPLE)'],
  ['#00FF00','#FF0000','green + red    (should be brown/olive)'],
  ['#FFFFFF','#000000','white + black  (should be mid GREY)'],
];
const modes = ['rgb','lab','oklab','ryb','hsl','spectral'] as const;

console.log('mode'.padEnd(9) + pairs.map(p=>p[0].slice(1)+'+'+p[1].slice(1)).map(s=>s.padEnd(15)).join(''));
for (const mode of modes) {
  const row = pairs.map(([a,b]) => blendColors(a,b,mode as any,0.5).hex.padEnd(15));
  console.log(mode.padEnd(9) + row.join(''));
}
console.log('\nLegend:');
pairs.forEach(p => console.log('  ' + p[0] + ' + ' + p[1] + '  ->  ' + p[2]));

console.log('\n--- K/S sanity (blending/conversions.ts) ---');
for (const r of [0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  console.log(`R=${String(r).padEnd(6)} K/S=${reflectanceToKS(r).toExponential(4).padEnd(12)} roundtrip R=${ksToReflectance(reflectanceToKS(r)).toFixed(6)}`);
}
console.log('\nmidpoint K/S of R=0 and R=1 ->', ((reflectanceToKS(0)+reflectanceToKS(1))/2).toFixed(4),
            '-> R =', ksToReflectance((reflectanceToKS(0)+reflectanceToKS(1))/2).toFixed(6),
            '-> 8bit', Math.round(ksToReflectance((reflectanceToKS(0)+reflectanceToKS(1))/2)*255));
