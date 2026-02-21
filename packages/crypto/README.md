# @xivdyetools/crypto

Shared cryptographic utilities for the xivdyetools ecosystem.

## Installation

```bash
npm install @xivdyetools/crypto
```

## Usage

```typescript
import {
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeBytes,
  base64UrlDecodeBytes,
  hexToBytes,
  bytesToHex,
} from '@xivdyetools/crypto';

// Base64URL encoding (for JWT)
const encoded = base64UrlEncode('{"alg":"HS256"}');
const decoded = base64UrlDecode(encoded);

// Byte encoding
const bytes = base64UrlDecodeBytes(encoded);
const reencoded = base64UrlEncodeBytes(bytes);

// Hex encoding
const hex = bytesToHex(bytes);
const backToBytes = hexToBytes(hex);
```

## API

### Base64URL (RFC 4648)

- `base64UrlEncode(str: string): string` - Encode UTF-8 string to Base64URL
- `base64UrlDecode(str: string): string` - Decode Base64URL to UTF-8 string
- `base64UrlEncodeBytes(bytes: Uint8Array): string` - Encode bytes to Base64URL
- `base64UrlDecodeBytes(str: string): Uint8Array` - Decode Base64URL to bytes

### Hexadecimal

- `hexToBytes(hex: string): Uint8Array` - Convert hex string to bytes
- `bytesToHex(bytes: Uint8Array): string` - Convert bytes to hex string

## Connect With Me

**Flash Galatine** | Balmung (Midgardsormr)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine
