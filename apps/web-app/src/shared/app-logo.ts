/**
 * XIV Dye Tools - App Logo SVG (5.0)
 *
 * The confirmed app icon (App Icon.dc.html 2a): the fully-loaded paint
 * bucket — wire handle, spill drips, dipped brush — with the rainbow dye
 * swirl in the mouth. This export is the transparent-ground artwork used in
 * web-app placements (header, About); the red #CE2222 tile variant ships as
 * the favicon assets and in worker-generated graphics.
 *
 * The geometry is flattened from the doc's <defs> (no <symbol>/<use>) with
 * prefixed clip-path ids so multiple instances can coexist in one document.
 *
 * @module shared/app-logo
 */

const BUCKET_SWIRL = `
      <g clip-path="url(#xdt-cp-paint)">
        <ellipse cx="256" cy="176" rx="132" ry="62" fill="#E5484D"/>
        <g transform="translate(256,176) scale(1,0.47)">
          <g transform="rotate(180)">
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#8E4EC6" stroke-width="32" stroke-linecap="round" transform="rotate(0)"/>
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#0091FF" stroke-width="32" stroke-linecap="round" transform="rotate(60)"/>
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#30A46C" stroke-width="32" stroke-linecap="round" transform="rotate(120)"/>
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#FFC53D" stroke-width="32" stroke-linecap="round" transform="rotate(180)"/>
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#F76B15" stroke-width="32" stroke-linecap="round" transform="rotate(240)"/>
            <path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="#E5484D" stroke-width="32" stroke-linecap="round" transform="rotate(300)"/>
            <circle cx="0" cy="0" r="17" fill="#8E4EC6"/>
          </g>
          <path d="M -108 -34 C -72 -76 22 -86 76 -56 C 22 -64 -58 -54 -94 -14 Z" fill="#FFFFFF" opacity="0.16"/>
        </g>
      </g>`;

/**
 * The official artwork on a transparent ground (viewBox 0 0 512 512).
 * Constant name kept from the pre-5.0 logo so consumers don't churn.
 */
export const LOGO_SPARKLES = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="xdt-cp-paint"><ellipse cx="256" cy="176" rx="132" ry="62"/></clipPath>
    <clipPath id="xdt-cp-front"><rect x="100" y="196" width="312" height="130"/></clipPath>
    <clipPath id="xdt-cp-spill"><path d="M 140 222 C 180 246 216 250 256 250 C 296 250 336 244 376 219 C 374 230 372 236 368 242 C 360 250 352 255 346 257 L 346 288 C 346 302 318 302 318 288 L 318 259 C 304 261 290 262 274 262 L 274 316 C 274 332 244 332 244 316 L 244 262 C 228 261 212 258 200 255 L 200 276 C 200 290 174 290 174 276 L 174 249 C 160 242 148 233 140 222 Z"/></clipPath>
  </defs>

  <path d="M 114 158 C 132 40 380 40 398 158" fill="none" stroke="#9BA1AD" stroke-width="14" stroke-linecap="round"/>

  <path d="M 108 176 C 112 270 122 356 140 402 C 162 436 350 436 372 402 C 390 356 400 270 404 176 C 404 222 338 250 256 250 C 174 250 108 222 108 176 Z" fill="#EEEFF3" stroke="#C8CCD5" stroke-width="3"/>
  <path d="M 140 402 C 162 436 350 436 372 402 C 370 396 368 390 366 386 C 344 412 168 412 146 386 C 144 390 142 396 140 402 Z" fill="#000000" opacity="0.07"/>
  <path d="M 108 176 C 108 222 174 250 256 250 C 338 250 404 222 404 176 C 402 192 396 206 388 218 C 354 250 308 268 256 268 C 204 268 158 250 124 218 C 116 206 110 192 108 176 Z" fill="#000000" opacity="0.06"/>

  <g clip-path="url(#xdt-cp-spill)">
    <rect x="130" y="205" width="46" height="140" fill="#E5484D"/>
    <rect x="176" y="205" width="44" height="140" fill="#F76B15"/>
    <rect x="220" y="205" width="44" height="140" fill="#FFC53D"/>
    <rect x="264" y="205" width="44" height="140" fill="#30A46C"/>
    <rect x="308" y="205" width="44" height="140" fill="#0091FF"/>
    <rect x="352" y="205" width="46" height="140" fill="#8E4EC6"/>
  </g>

  <ellipse cx="256" cy="176" rx="148" ry="74" fill="#FBFBFC"/>
${BUCKET_SWIRL}

  <ellipse cx="230" cy="198" rx="48" ry="16" fill="#000000" opacity="0.20"/>
  <g clip-path="url(#xdt-cp-paint)">
    <g transform="translate(232,196) rotate(34)">
      <path d="M -38 16 L -40 -38 L 40 -38 L 38 16 Z" fill="#E3C79E" stroke="#C2A578" stroke-width="2"/>
      <path d="M -39 16 L -39 -14 L 39 -14 L 38 16 Z" fill="#8E4EC6"/>
    </g>
  </g>
  <g transform="translate(232,196) rotate(34)">
    <path d="M -42 -38 L 42 -38 L 42 -66 L -42 -66 Z" fill="#C3C8D2" stroke="#9BA1AD" stroke-width="2"/>
    <path d="M -42 -52 L 42 -52" stroke="#9BA1AD" stroke-width="3"/>
    <path d="M -15 -66 L -11 -140 C -11 -150 -13 -158 -13 -164 C -13 -174 -6 -180 0 -180 C 6 -180 13 -174 13 -164 C 13 -158 11 -150 11 -140 L 15 -66 Z M 6 -159 A 6 6 0 1 0 -6 -159 A 6 6 0 1 0 6 -159 Z" fill="#F0E3C8" fill-rule="evenodd" stroke="#C8B48E" stroke-width="2.5"/>
  </g>

  <g clip-path="url(#xdt-cp-front)">${BUCKET_SWIRL}
  </g>
  <ellipse cx="212" cy="205" rx="36" ry="11" fill="#000000" opacity="0.14"/>

  <g clip-path="url(#xdt-cp-paint)">
    <ellipse cx="256" cy="176" rx="127" ry="57" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="10"/>
  </g>
</svg>`;
