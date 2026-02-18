# Dye Mixer

**Blend two dyes together to create custom colors**

The Dye Mixer is a new tool in XIV Dye Tools v4.0.0 that lets you blend two dyes together using multiple color mixing algorithms, then find the closest matching FFXIV dyes.

> **Note**: This is a completely different tool from the Gradient Builder (previously called "Dye Mixer" in v3.x). The Gradient Builder creates color *transitions*, while this tool creates color *blends*.

---

## How It Works

The Dye Mixer blends two dyes using your choice of color mixing algorithm:

1. **Input Slot 1** - First dye color
2. **Input Slot 2** - Second dye color
3. **Blending Mode** - Choose RGB, RYB, or LAB mixing
4. **Result** - The blended color based on your selected mode
5. **Matching** - Find FFXIV dyes closest to the blended result

---

## How to Use

### 1. Select Two Dyes

Fill both input slots:
- **Search by name** - Type to find dyes
- **Pick from list** - Browse by category
- **Use the palette drawer** - Quick access to all dyes

### 2. View the Blend

The mixer shows:
- **Blended color preview** - The averaged result
- **Matched dyes** - 3-8 closest FFXIV dyes to the blend
- **Delta E scores** - How close each match is

### 3. Choose Blending Mode

Select how colors are mixed:
- **RGB** - Digital light-based mixing (default)
- **RYB** - Traditional paint-based mixing
- **LAB** - Perceptually uniform mixing

### 4. Adjust Settings

In the left panel:
- **Blending mode** - RGB, RYB, or LAB
- **Result count** - Show 3-8 matched dyes
- **Dye filters** - Filter results by category (Metallic, Pastel, etc.)
- **Market board** - See pricing for matched dyes

---

## Crafting-Style Interface

The Dye Mixer uses a crafting-inspired UI:

```
┌─────────┐   ┌─────────┐
│  Dye 1  │ + │  Dye 2  │
└────┬────┘   └────┬────┘
     │             │
     └──────┬──────┘
            ▼
      ┌───────────┐
      │  Result   │
      │  (Blend)  │
      └───────────┘
```

- **100x100px input slots** - Your selected dyes
- **120x120px result slot** - The blended color

---

## Blending Modes Explained

### RGB Mode (Digital)
Blends colors as light would mix on a screen. Additive color mixing.

| Dye 1 | Dye 2 | RGB Result |
|-------|-------|------------|
| Red + Blue | → | Purple |
| Red + Green | → | Yellow |
| White + Black | → | Gray |

**Best for**: When you want results that match how colors appear on screens.

### RYB Mode (Traditional)
Blends colors like paint mixing in art class. Subtractive color mixing based on the traditional red-yellow-blue color wheel.

| Dye 1 | Dye 2 | RYB Result |
|-------|-------|------------|
| Red + Blue | → | Purple |
| Yellow + Blue | → | Green |
| Red + Yellow | → | Orange |

**Best for**: Intuitive mixing that matches traditional art expectations.

### LAB Mode (Perceptual)
Blends colors in CIE LAB color space, which is designed to match human perception. Creates the most "natural-looking" blends.

**Best for**: Getting blends that look balanced and natural to the human eye.

---

**Tip**: Unlike gradient interpolation, blending creates a single averaged color rather than a transition path. Try different modes—the same two dyes can produce noticeably different results!

---

## Dye Action Menu

Click the **⋮ menu** on any result dye to:
- **Add to Favorites** - Save for later
- **Add to Collection** - Organize into groups
- **See Color Harmonies** - Find complementary dyes
- **Open in Comparison** - Compare side-by-side

---

## Use Cases

### Creating Custom Colors
Find dyes that don't exist as single colors:
1. Blend two close-but-not-quite dyes
2. See what averaged color emerges
3. Find the closest FFXIV match

### Color Experimentation
Discover unexpected combinations:
1. Try blending complementary colors
2. Mix warm and cool tones
3. Combine metallic and non-metallic dyes

### Outfit Planning
Find "middle ground" dyes for coordinated looks:
1. Blend your two favorite outfit colors
2. Use the result as an accent color
3. Create cohesive multi-piece glamours

---

## Tips

- **Similar colors** create subtle variations
- **Contrasting colors** can create muddy results in RGB/RYB, but often look better in LAB
- Use **Delta E scores** to gauge match quality (lower = better)
- **Try all three modes** - you might be surprised which gives the best result
- **RYB mode** is great if you're thinking "what would happen if I mixed these paints?"
- **LAB mode** often produces the most visually pleasing middle-ground

---

## Dye Mixer vs Gradient Builder

| Feature | Dye Mixer | Gradient Builder |
|---------|-----------|------------------|
| Output | Single blended color | Multiple gradient steps |
| Method | RGB, RYB, or LAB blending | HSV color space interpolation |
| Use case | "Mix these colors" | "Transition between colors" |
| Results | 3-8 matched dyes | 5-10 intermediate dyes |

---

## Related Tools

- [Gradient Builder](gradient-builder.md) - Create color transitions
- [Palette Extractor](palette-extractor.md) - Find dyes from any color
- [Dye Comparison](dye-comparison.md) - Compare your blend results
