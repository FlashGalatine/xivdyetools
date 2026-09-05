/* Round 3: where does the OKLab hue of the sRGB pure-hue circle stop being monotonic? */
const srgbToLinear=(c)=>{const cc=c/255;return cc<=0.04045?cc/12.92:Math.pow((cc+0.055)/1.055,2.4);};
function hsvToRgb(h,s,v){const S=s/100,V=v/100;const c=V*S,x=c*(1-Math.abs(((h/60)%2)-1)),m=V-c;let r=0,g=0,b=0;if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255];}
function rgbToOklab(r,g,b){const R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B);const m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B);const s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);return[0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s];}
function labD65(r,g,b){const R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);let X=(R*0.4124564+G*0.3575761+B*0.1804375)/0.95047,Y=R*0.2126729+G*0.7151522+B*0.072175,Z=(R*0.0193339+G*0.119192+B*0.9503041)/1.08883;const f=(t)=>t>0.008856?Math.cbrt(t):7.787*t+16/116;return[116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))];}

function hueTable(fn,label){
  const pts=[];let prev=null;
  for(let i=0;i<=3600;i++){
    const h=i/10;
    const c=fn(...hsvToRgb(h%360,100,100));
    let H=Math.atan2(c[2],c[1])*180/Math.PI;if(H<0)H+=360;
    if(prev!==null){while(H<prev-180)H+=360;while(H>prev+180)H-=360;}
    prev=H;pts.push([h,H]);
  }
  const off=pts[0][1];const norm=pts.map(([h,H])=>[h,H-off]);
  // find decreasing runs
  const runs=[];let cur=null;
  for(let i=1;i<norm.length;i++){
    if(norm[i][1]<norm[i-1][1]-1e-9){
      if(!cur)cur={from:norm[i-1][0],to:norm[i][0],drop:0};
      cur.to=norm[i][0];cur.drop+=norm[i-1][1]-norm[i][1];
    } else if(cur){runs.push(cur);cur=null;}
  }
  if(cur)runs.push(cur);
  console.log(`\n${label}: span ${norm[norm.length-1][1].toFixed(2)}°, ${runs.length} decreasing run(s)`);
  for(const r of runs)console.log(`   HSV ${r.from.toFixed(1)}°..${r.to.toFixed(1)}° reverses by ${r.drop.toFixed(2)}°`);
  return norm;
}
hueTable(rgbToOklab,'OKLab hue of sRGB pure-hue circle (S=100,V=100)');
hueTable(labD65,'CIELab hue of sRGB pure-hue circle (S=100,V=100)');

// Same, but at a mid grey-ish saturation/value, which is what real dyes look like
function hueTable2(fn,label,s,v){
  const pts=[];let prev=null;
  for(let i=0;i<=3600;i++){const h=i/10;const c=fn(...hsvToRgb(h%360,s,v));let H=Math.atan2(c[2],c[1])*180/Math.PI;if(H<0)H+=360;if(prev!==null){while(H<prev-180)H+=360;while(H>prev+180)H-=360;}prev=H;pts.push([h,H]);}
  const off=pts[0][1];const norm=pts.map(([h,H])=>[h,H-off]);
  let dec=0,worst=0;
  for(let i=1;i<norm.length;i++){const d=norm[i-1][1]-norm[i][1];if(d>1e-9){dec++;worst=Math.max(worst,d);}}
  console.log(`${label} (s=${s},v=${v}): span ${norm[norm.length-1][1].toFixed(2)}°, decreasing samples ${dec}/3600`);
  return norm;
}
console.log('');
hueTable2(rgbToOklab,'OKLab',60,70);
hueTable2(rgbToOklab,'OKLab',100,50);
hueTable2(labD65,'CIELab',60,70);
