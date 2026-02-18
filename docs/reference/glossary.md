# Glossary

**Terms and concepts used throughout XIV Dye Tools**

---

## Color Theory

### Analogous Colors
Colors that are adjacent on the color wheel (within ~30° of hue). Create harmonious, low-contrast palettes.

### Brettel Algorithm
Color vision simulation algorithm (Brettel, Viénot, Mollon 1997) that accurately simulates how colors appear to people with protanopia, deuteranopia, and tritanopia.

### CIE LAB
Perceptually uniform color space designed to approximate human vision. Used for calculating deltaE color differences.

### Complementary Colors
Colors opposite each other on the color wheel (180° apart). Create high-contrast, vibrant combinations.

### Delta E (ΔE)
Measure of perceptual color difference. Lower values = more similar.

| Value | Meaning |
|-------|---------|
| 0-1 | Imperceptible |
| 1-2 | Barely noticeable |
| 2-10 | Noticeable at a glance |
| 10-50 | Colors are similar |
| 50+ | Colors are different |

### HSV / HSB
Hue-Saturation-Value (or Brightness) color model. More intuitive than RGB for color selection:
- **Hue**: 0-360° position on color wheel
- **Saturation**: 0-100% color purity
- **Value**: 0-100% lightness

### Hue
The "pure" color on the color wheel, measured in degrees (0-360°). Red=0°, Green=120°, Blue=240°.

### K-means++ Clustering
Algorithm for extracting dominant colors from images. Improves on standard K-means with smarter centroid initialization.

### k-d Tree
Data structure for efficient nearest-neighbor searches in multi-dimensional space. Used for O(log n) dye matching in RGB space.

### Monochromatic
Color scheme using variations of a single hue with different saturation and brightness values.

### RGB
Red-Green-Blue color model used by displays. Each channel ranges 0-255.

### Split Complementary
Color harmony using a base color and two colors adjacent to its complement. Less jarring than pure complementary.

### Tetradic (Rectangle)
Four-color harmony using two complementary pairs. Creates rich, varied palettes.

### Triadic
Three colors equally spaced on the color wheel (120° apart). Vibrant and balanced.

### WCAG Contrast
Web Content Accessibility Guidelines contrast ratio requirements:
- **AA**: 4.5:1 for normal text, 3:1 for large text
- **AAA**: 7:1 for normal text, 4.5:1 for large text

---

## FFXIV Terms

### Dye
In-game consumable item that changes equipment color. XIV Dye Tools covers all 136 dyes.

### General-Purpose Dye
Dyes that can be purchased from NPC vendors for gil. Cheaper and more accessible.

### Glamour
FFXIV's transmog/appearance system allowing players to change equipment appearance.

### Marketboard
In-game auction house where players buy/sell items, including dyes.

### Special Dye
Rare dyes obtained from crafting, dungeons, or events. Often more expensive.

### Universalis API
Community-maintained API providing real-time FFXIV marketboard prices across all data centers.

---

## XIV Dye Tools (v4)

### Community Presets
Web app tool (v4) for browsing and sharing community dye palettes. Formerly called "Preset Browser" in v3. Discord bot uses `/preset` commands.

### Dye Mixer (v4)
Web app tool (v4) for blending two dyes together to create custom color combinations. Supports three blending modes: RGB (digital/additive), RYB (traditional/subtractive), and LAB (perceptual). This is a **new tool in v4.0.0**, distinct from the renamed "Gradient Builder."

### Glassmorphism
UI design trend featuring frosted glass effects, transparency, and blur. Used in the web app v4.0.0 UI redesign.

### Gradient Builder
Web app tool (v4) for creating smooth color gradients between two dyes. Formerly called "Dye Mixer" in v3. Discord bot still uses `/mixer` command.

### Palette Extractor
Web app tool (v4) for finding the closest FFXIV dye to any color and extracting color palettes from images. Formerly called "Color Matcher" in v3. Discord bot still uses `/match` command.

### Swatch Matcher
Web app tool (v4) for matching specific colors sampled from FFXIV character customization (hair, eyes, skin) to FFXIV dyes. Formerly called "Character Color Matcher" in v3.

---

## Technical Terms

### Branded Types
TypeScript pattern using intersection types to create nominally distinct types from primitives. Example: `HexColor` vs plain `string`.

### Cloudflare D1
Cloudflare's serverless SQLite database. Used for community presets storage.

### Cloudflare KV
Cloudflare's key-value store. Used for user favorites, collections, and caching.

### Cloudflare Workers
Serverless edge compute platform. Hosts Discord bot, OAuth, and presets API.

### Ed25519
Elliptic curve signature algorithm used by Discord for interaction verification.

### Facade Pattern
Design pattern where a simple interface wraps complex subsystems. Used by ColorService and DyeService.

### HTTP Interactions
Discord's webhook-based interaction model. Bot receives HTTP POST requests instead of maintaining WebSocket connection.

### JWT (JSON Web Token)
Compact, URL-safe token format for authentication. Used for web app authentication.

### Lit
Fast, lightweight web components library. Powers the web application.

### LRU Cache
Least Recently Used cache eviction policy. Used by ColorConverter for performance.

### PKCE
Proof Key for Code Exchange. OAuth 2.0 extension for public clients (like SPAs).

### Service Binding
Cloudflare Workers feature allowing direct worker-to-worker calls without HTTP overhead.

### Vite
Modern frontend build tool. Used for web app development and production builds.

---

## Acronyms

| Acronym | Meaning |
|---------|---------|
| API | Application Programming Interface |
| CF | Cloudflare |
| CLI | Command Line Interface |
| CORS | Cross-Origin Resource Sharing |
| CSP | Content Security Policy |
| CSS | Cascading Style Sheets |
| D1 | Cloudflare D1 (database) |
| FFXIV | Final Fantasy XIV |
| HSV | Hue, Saturation, Value |
| i18n | Internationalization |
| JWT | JSON Web Token |
| KV | Key-Value (store) |
| LAB | CIE LAB color space |
| LRU | Least Recently Used |
| NPM | Node Package Manager |
| OAuth | Open Authorization |
| PKCE | Proof Key for Code Exchange |
| RGB | Red, Green, Blue |
| SVG | Scalable Vector Graphics |
| UI | User Interface |
| UX | User Experience |
| WASM | WebAssembly |
| WCAG | Web Content Accessibility Guidelines |

---

## Related Documentation

- [Color Algorithms](../projects/core/algorithms.md) - Implementation details
- [Architecture Overview](../architecture/overview.md) - System design
