# Additive Discord font prerequisite reproduction

This is the preparation proof for cut 05a, Discord 5.9.1. It adds JP U+53CE and
SC U+4ECD/U+53CE/U+800C to the baseline subsets without removing existing codepoints.
It starts no terminal F-DISCORD/F-OG work and authorizes no deployment.

Run from the root of a checkout containing the prepared additive fonts, the two source
commits named in the script, and frozen workspace dependencies. Python must have fontTools
4.61.1; the script checks that exact version. The renderer is the locked resvg 2.6.2 WASM.

```powershell
python docs/audits/2026-10-26-security/evidence/isolated-font-reproduction/assemble-union.py
node docs/audits/2026-10-26-security/evidence/isolated-font-reproduction/render-proof.mjs
```

Both commands are local. They write only ignored `.superpowers/sdd/2026-10-29-font-reproduction/`
outputs. The assembler compares reproduced bytes with the prepared application fonts and
fails on a mismatch; it never overwrites application files. No network or Git write is needed.
The portable scripts were rerun successfully against the prepared fonts before publication
of this evidence.

[font-proof.json](font-proof.json) records source/output hashes, cmap additions, old glyph
signatures, metadata/layout checks and rendered atlas hashes. The 5,001 old glyph comparisons
use expanded and recompiled fontTools records, not original raw `glyf` file slices. The 3,509
old codepoints render identically at sizes 9, 12, 24 and 48 with the specified renderer and no
system fonts. Four new face/codepoint pairs differ from the missing-glyph control and match
the reviewed reference at those sizes. These checks do not establish every renderer's shaping
behavior or hosted resource acceptance.
