import { blendColors } from '../../../../packages/core/src/blending/blending.ts';
import { ColorService } from '../../../../packages/core/src/services/ColorService.ts';
const steps = [0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1];
for (const [a,b,label] of [['#0000FF','#FFFF00','blue -> yellow'],['#000000','#FFFFFF','black -> white'],['#5B3E90','#E8B923','Ala Mhigan Purple -> Gold']] as const) {
  console.log(`\n${label}`);
  console.log('  t      bot core/blending "spectral"   web ColorService spectral (spectral.js)');
  for (const t of steps) {
    const bot = blendColors(a,b,'spectral' as any,t).hex;
    const web = ColorService.mixColorsSpectral(a,b,t);
    console.log(`  ${t.toFixed(1)}    ${bot.padEnd(30)} ${web}`);
  }
}
