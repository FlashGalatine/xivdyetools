// Probe: where does core's existing rybToRgb (packages/core/src/blending/conversions.ts)
// place the twelve RYB hues, if "RYB hue" is the HSV hexcone hue of the (r,y,b) triple?
// Copied verbatim from core so the numbers describe the shipped model.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function rybToRgb({ r, y, b }) {
  const w = Math.min(r, y, b);
  const r_ = r - w, y_ = y - w, b_ = b - w;
  const my = Math.max(r_, y_, b_);
  let g = Math.min(y_, b_);
  const y__ = y_ - g, b__ = b_ - g;
  const r__ = r_ + y__;
  g = g + y__;
  const n = Math.max(r__, g, b__) / Math.max(my, 0.001);
  return {
    r: Math.round(clamp((r__ / Math.max(n, 0.001) + w) * 255, 0, 255)),
    g: Math.round(clamp((g / Math.max(n, 0.001) + w) * 255, 0, 255)),
    b: Math.round(clamp((b__ / Math.max(n, 0.001) + w) * 255, 0, 255)),
  };
}
function hsvToTriple(h, s = 1, v = 1) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let t;
  if (h < 60) t = [c, x, 0]; else if (h < 120) t = [x, c, 0]; else if (h < 180) t = [0, c, x];
  else if (h < 240) t = [0, x, c]; else if (h < 300) t = [x, 0, c]; else t = [c, 0, x];
  return t.map((q) => q + m);
}
function rgbHue({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return NaN;
  let h;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}
const rows = [];
for (let a = 0; a < 360; a += 30) {
  const [r, y, b] = hsvToTriple(a);
  const rgb = rybToRgb({ r, y, b });
  const hex = '#' + [rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  rows.push({ rybAngle: a, srgbHue: Math.round(rgbHue(rgb) * 10) / 10, hex, V: Math.max(rgb.r, rgb.g, rgb.b) / 255 });
}
console.table(rows);
