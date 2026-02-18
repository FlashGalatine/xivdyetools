# Data Center Reference

**XIV Dye Tools Discord Bot** - Complete Data Center Support

**Version**: 1.0.0
**Last Updated**: November 22, 2025
**Source**: [Universalis API](https://universalis.app/api/v2/data-centers)

---

## Complete Data Center List

### North America (4 DCs)

```typescript
'Aether'
'Crystal'
'Dynamis'
'Primal'
```

### Europe (2 DCs)

```typescript
'Chaos'
'Light'
```

### Oceania (1 DC)

```typescript
'Materia'
```

### Japan (4 DCs)

```typescript
'Elemental'
'Gaia'
'Mana'
'Meteor'
```

### China (4 DCs)

```typescript
'陆行鸟'  // LuXingNiao (Chocobo)
'莫古力'  // MoGuLi (Moogle)
'猫小胖'  // MaoXiaoPang (Cait Sith)
'豆豆柴'  // DouDouChai (Twintania)
```

### Korea (1 DC)

```typescript
'한국'  // Korea
```

---

## Implementation

### Discord Command Choices

```typescript
const DATA_CENTERS = [
  // North America
  { name: 'Aether', value: 'Aether' },
  { name: 'Crystal', value: 'Crystal' },
  { name: 'Dynamis', value: 'Dynamis' },
  { name: 'Primal', value: 'Primal' },

  // Europe
  { name: 'Chaos', value: 'Chaos' },
  { name: 'Light', value: 'Light' },

  // Oceania
  { name: 'Materia', value: 'Materia' },

  // Japan
  { name: 'Elemental', value: 'Elemental' },
  { name: 'Gaia', value: 'Gaia' },
  { name: 'Mana', value: 'Mana' },
  { name: 'Meteor', value: 'Meteor' },

  // China (display with romanization for clarity)
  { name: '陆行鸟 (LuXingNiao)', value: '陆行鸟' },
  { name: '莫古力 (MoGuLi)', value: '莫古力' },
  { name: '猫小胖 (MaoXiaoPang)', value: '猫小胖' },
  { name: '豆豆柴 (DouDouChai)', value: '豆豆柴' },

  // Korea
  { name: '한국 (Korea)', value: '한국' }
] as const;

// Register as Discord slash command choices
{
  name: 'data_center',
  description: 'Data center for market board prices',
  type: ApplicationCommandOptionType.String,
  required: false,
  choices: DATA_CENTERS
}
```

### API Service Usage

```typescript
import fetch from 'node-fetch';
import pLimit from 'p-limit';

class UniversalisService {
  private static BASE_URL = 'https://universalis.app/api/v2';

  // Rate limiting: 25 req/s, max 8 concurrent connections
  private static rateLimiter = pLimit(8); // Max 8 concurrent requests
  private static requestQueue: Promise<any>[] = [];
  private static lastRequestTime = 0;
  private static MIN_REQUEST_INTERVAL = 40; // 25 req/s = 40ms between requests

  /**
   * Fetch market board prices for an item
   * @param itemID - FFXIV item ID
   * @param dataCenter - Data center (supports CJK characters)
   */
  static async getPrices(itemID: number, dataCenter: string) {
    return this.rateLimiter(async () => {
      // Enforce minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve =>
          setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
      }

      this.lastRequestTime = Date.now();

      // CJK characters work directly - modern fetch handles encoding
      const url = `${this.BASE_URL}/aggregated/${dataCenter}/${itemID}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Universalis API error: ${response.status}`);
      }

      return await response.json();
    });
  }
}

// Usage examples - all work correctly with rate limiting:
await UniversalisService.getPrices(5729, 'Aether');      // ✅ English
await UniversalisService.getPrices(5729, '陆行鸟');       // ✅ Chinese
await UniversalisService.getPrices(5729, '한국');         // ✅ Korean

// Batch requests are automatically throttled:
const results = await Promise.all([
  UniversalisService.getPrices(5729, 'Aether'),
  UniversalisService.getPrices(5730, 'Aether'),
  UniversalisService.getPrices(5731, 'Aether'),
  // ... up to 50 concurrent (respects 8 connection limit + 25 req/s)
]);
```

### Redis Caching with CJK

```typescript
import Redis from 'ioredis';

class PriceCache {
  constructor(private redis: Redis) {}

  async get(itemID: number, dataCenter: string) {
    // CJK characters safe in Redis keys
    const key = `price:${dataCenter}:${itemID}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(itemID: number, dataCenter: string, data: any, ttl = 300) {
    const key = `price:${dataCenter}:${itemID}`;
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }
}

// Examples:
cache.set(5729, '陆行鸟', priceData);  // ✅ Works
cache.get(5729, '한국');                // ✅ Works
```

---

## Unicode Handling

### Why CJK Characters Work

**Modern standards fully support Unicode**:

1. **Discord.js** - Full UTF-8 support in slash commands
2. **Node.js fetch** - Automatic URL encoding (Node 18+)
3. **Redis** - UTF-8 safe for keys and values
4. **TypeScript** - Native Unicode string support
5. **Universalis API** - Uses CJK as official identifiers

### No Manual Encoding Needed

```typescript
// ❌ Don't do this (unnecessary)
const encoded = encodeURIComponent('陆行鸟');
const url = `https://universalis.app/api/v2/aggregated/${encoded}/5729`;

// ✅ Do this (automatic encoding)
const url = `https://universalis.app/api/v2/aggregated/陆行鸟/5729`;
const response = await fetch(url); // fetch handles encoding internally
```

### Display in Discord Embeds

```typescript
const embed = new EmbedBuilder()
  .setTitle('Market Board Prices')
  .addFields(
    { name: 'Data Center', value: '陆行鸟 (LuXingNiao)' },  // ✅ Displays correctly
    { name: 'Item', value: 'Dalamud Red' },
    { name: 'Price', value: '1,250 Gil' }
  );

await interaction.reply({ embeds: [embed] });
```

---

## Validation

### Zod Schema

```typescript
import { z } from 'zod';

const DataCenterSchema = z.enum([
  // North America
  'Aether', 'Crystal', 'Dynamis', 'Primal',

  // Europe
  'Chaos', 'Light',

  // Oceania
  'Materia',

  // Japan
  'Elemental', 'Gaia', 'Mana', 'Meteor',

  // China
  '陆行鸟', '莫古力', '猫小胖', '豆豆柴',

  // Korea
  '한국'
]);

type DataCenter = z.infer<typeof DataCenterSchema>;

// Usage in command handler
const validated = DataCenterSchema.parse(interaction.options.getString('data_center'));
```

### Runtime Validation

```typescript
const VALID_DATA_CENTERS = new Set([
  'Aether', 'Crystal', 'Dynamis', 'Primal',
  'Chaos', 'Light',
  'Materia',
  'Elemental', 'Gaia', 'Mana', 'Meteor',
  '陆行鸟', '莫古力', '猫小胖', '豆豆柴',
  '한국'
]);

function isValidDataCenter(dc: string): boolean {
  return VALID_DATA_CENTERS.has(dc);
}

// Example
if (!isValidDataCenter(userInput)) {
  throw new Error(`Invalid data center: ${userInput}`);
}
```

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('Data Center Support', () => {
  it('should fetch prices for English data centers', async () => {
    const result = await UniversalisService.getPrices(5729, 'Aether');
    expect(result).toBeDefined();
  });

  it('should fetch prices for Chinese data centers', async () => {
    const result = await UniversalisService.getPrices(5729, '陆行鸟');
    expect(result).toBeDefined();
  });

  it('should fetch prices for Korean data center', async () => {
    const result = await UniversalisService.getPrices(5729, '한국');
    expect(result).toBeDefined();
  });

  it('should cache results with CJK keys', async () => {
    await cache.set(5729, '陆行鸟', { price: 1000 });
    const cached = await cache.get(5729, '陆行鸟');
    expect(cached).toEqual({ price: 1000 });
  });
});
```

### Integration Test

```typescript
describe('Discord Command Integration', () => {
  it('should accept all valid data centers', async () => {
    const dataCenters = [
      'Aether', 'Crystal', '陆行鸟', '한국'
    ];

    for (const dc of dataCenters) {
      const interaction = mockInteraction({
        data_center: dc
      });

      await expect(
        harmonyCommand.execute(interaction)
      ).resolves.not.toThrow();
    }
  });
});
```

---

## Error Handling

### Graceful Degradation

```typescript
async function fetchPricesWithFallback(itemID: number, dataCenter: string) {
  try {
    return await UniversalisService.getPrices(itemID, dataCenter);
  } catch (error) {
    logger.warn(`Failed to fetch prices for ${dataCenter}:`, error);

    // Graceful degradation - use base vendor price
    return {
      minPrice: getVendorPrice(itemID),
      source: 'vendor',
      note: 'Live market board data unavailable'
    };
  }
}
```

### User-Friendly Error Messages

```typescript
function formatDataCenterError(dataCenter: string): string {
  // Check if it's a known DC but API failed
  if (VALID_DATA_CENTERS.has(dataCenter)) {
    return `⚠️ Price data temporarily unavailable for ${dataCenter}. Showing base prices.`;
  }

  // Unknown DC - suggest valid options
  return `❌ Invalid data center: ${dataCenter}\n\nValid options: Aether, Crystal, 陆行鸟, 한국, etc.`;
}
```

---

## Best Practices

### ✅ Do

- Use CJK characters directly in API calls
- Display romanization alongside CJK for clarity (`陆行鸟 (LuXingNiao)`)
- Validate data center names before API calls
- Cache results with CJK-safe keys
- Handle API failures gracefully

### ❌ Don't

- Manually encode CJK characters (fetch handles it)
- Replace CJK with ASCII-only identifiers
- Assume all users speak English (support native names)
- Hard-code data center lists (fetch from Universalis dynamically)
- Skip validation (prevent invalid API calls)

---

## Resources

- **Universalis Data Centers API**: https://universalis.app/api/v2/data-centers
- **Universalis Worlds API**: https://universalis.app/api/v2/worlds
- **Discord.js UTF-8 Support**: [discord.js.org](https://discord.js.org)
- **Node.js URL Encoding**: [Node.js Docs](https://nodejs.org/api/url.html)

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
