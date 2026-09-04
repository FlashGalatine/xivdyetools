import { blendColors } from '../../../../packages/core/src/blending/blending.ts';
import { ColorService } from '../../../../packages/core/src/services/ColorService.ts';
import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';

const pairs: Array<[string,string,string]> = [
  ['#0000FF','#FFFF00','blue+yellow'],
  ['#FF0000','#FFFF00','red+yellow'],
  ['#FFFFFF','#FF0000','white+red'],
  ['#0000FF','#FF0000','blue+red'],
  ['#00FF00','#FF0000','green+red'],
  ['#FFFFFF','#000000','white+black'],
  ['#3B5998','#E8B923','navy+gold'],
];

const svc: Record<string,(a:string,b:string,r:number)=>string> = {
  rgb: (a,b,r)=>ColorService.mixColorsRgb(a,b,r),
  lab: (a,b,r)=>ColorService.mixColorsLab(a,b,r),
  oklab: (a,b,r)=>ColorService.mixColorsOklab(a,b,r),
  ryb: (a,b,r)=>ColorService.mixColorsRyb(a,b,r),
  hsl: (a,b,r)=>ColorService.mixColorsHsl(a,b,r),
  spectral: (a,b,r)=>ColorService.mixColorsSpectral(a,b,r),
};

const modes = ['rgb','lab','oklab','ryb','hsl','spectral'] as const;
console.log('MODE      PAIR              core/blending   ColorService    dE00   AGREE?');
console.log('-'.repeat(78));
let diverging = 0, total = 0;
for (const mode of modes) {
  for (const [a,b,label] of pairs) {
    const x = blendColors(a,b,mode as any,0.5).hex.toLowerCase();
    const y = svc[mode](a,b,0.5).toLowerCase();
    const d = ColorConverter.getDeltaE2000(ColorConverter.hexToLab(x), ColorConverter.hexToLab(y));
    total++;
    const agree = x===y;
    if (!agree) diverging++;
    console.log(mode.padEnd(10)+label.padEnd(18)+x.padEnd(16)+y.padEnd(16)+d.toFixed(1).padStart(5)+'  '+(agree?'yes':'NO'));
  }
  console.log('-'.repeat(78));
}
console.log(`\n${diverging}/${total} of the (mode, pair) cells DISAGREE between the bot path (core/blending) and the web path (ColorService).`);
