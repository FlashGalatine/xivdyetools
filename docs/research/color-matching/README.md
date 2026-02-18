# Color Matching Research

Research into perceptual color matching algorithms for XIV Dye Tools.

## Documents

| Document | Description |
|----------|-------------|
| [COLOR_MATCHING_ALGORITHMS.md](./COLOR_MATCHING_ALGORITHMS.md) | Comprehensive research on Delta-E variants, OKLAB, HyAB, and other algorithms |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Code examples and integration steps for xivdyetools-core |

## Summary

### Current State
- RGB Euclidean for k-d tree lookups
- CIEDE2000 for perceptual matching
- Hue-based matching for harmonies

### Recommended Additions
1. **OKLAB Euclidean** - Simple, accurate, modern standard
2. **HyAB** - Best for large color differences (palette matching)
3. **OKLCH Weighted** - User-controllable L/C/H priority

### Key Finding
The **HyAB algorithm** (Abasi et al., 2019) outperforms both Euclidean and CIEDE2000 for large color differences (>10 units), making it ideal for finding closest dye matches where the nearest color may be 15-30 ΔE units away.

## References

- [OKLAB - Björn Ottosson](https://bottosson.github.io/posts/oklab/)
- [HyAB Research Paper](https://onlinelibrary.wiley.com/doi/abs/10.1002/col.22451)
- [ColorAide Distance Documentation](https://facelessuser.github.io/coloraide/distance/)

---

*Research conducted January 2026*
