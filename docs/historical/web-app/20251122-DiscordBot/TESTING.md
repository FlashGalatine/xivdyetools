# Testing Guide - XIV Dye Tools Discord Bot

## Overview

The Discord bot has a comprehensive test suite with **280 tests** across 8 test files, ensuring reliability and consistency with the web app.

### Test Framework

- **Framework**: [Vitest](https://vitest.dev/) v1.6.1
- **Environment**: Node.js
- **Coverage**: v8 provider (HTML, JSON, text reports)
- **Test Runner**: Vitest with hot module reloading

---

## Test Coverage Breakdown

### Total: 280 Tests (100% passing)

| Category | Tests | Files | Purpose |
|----------|-------|-------|---------|
| **Unit Tests** | 113 | 3 | Core utilities and helpers |
| **Integration Tests** | 140 | 4 | Discord command workflows |
| **Parity Tests** | 27 | 1 | Web app consistency |

---

## Unit Tests (113 tests)

### 1. Validators (`src/utils/validators.test.ts`) - 30 tests

Tests all input validation functions:
- **validateHexColor** (11 tests): Hex format, case handling, error messages
- **validateHarmonyType** (5 tests): All 9 harmony types
- **validateDataCenter** (6 tests): NA/EU/JP/OCE data centers, case sensitivity
- **validateIntRange** (5 tests): Min/max boundaries, custom field names
- **findDyeByName** (3 tests): Exact/partial matching, case insensitivity

**Example:**
```typescript
it('should accept lowercase hex colors with #', () => {
    expect(validateHexColor('#ff0000')).toEqual({ valid: true });
    expect(validateHexColor('#abcdef')).toEqual({ valid: true });
});
```

### 2. Emoji Utilities (`src/utils/emoji.test.ts`) - 19 tests

Tests emoji file handling:
- **getDyeEmojiFilename** (3 tests): Filename format (`dye_{itemID}.webp`)
- **hasDyeEmoji** (3 tests): Boolean existence checks
- **getDyeEmojiPath** (5 tests): Path resolution, absolute paths
- **getDyeEmojiBuffer** (8 tests): Buffer loading, WebP validation

**WebP Validation Example:**
```typescript
it('should return valid WebP data', () => {
    const buffer = getDyeEmojiBuffer(mockDye);
    if (buffer) {
        const header = buffer.toString('ascii', 0, 4);
        expect(header).toBe('RIFF'); // WebP header
        const webpSignature = buffer.toString('ascii', 8, 12);
        expect(webpSignature).toBe('WEBP');
    }
});
```

### 3. Embed Builder (`src/utils/embed-builder.test.ts`) - 64 tests

Tests Discord embed creation functions:
- **COLORS constants** (3 tests): Discord brand colors
- **formatColorSwatch** (6 tests): Unicode blocks, sizing
- **formatRGB** (7 tests): Color conversion accuracy
- **formatHSV** (5 tests): HSV formatting, hue angles
- **formatPrice** (5 tests): Gil formatting, locale strings
- **createErrorEmbed** (6 tests): Error embeds with ❌ prefix
- **createSuccessEmbed** (4 tests): Success embeds with ✅ prefix
- **createInfoEmbed** (4 tests): Info embeds (no prefix)
- **createDyeEmbed** (10 tests): Color info, emoji thumbnails
- **createHarmonyEmbed** (11 tests): Base dye, companions, angles
- **createDyeEmojiAttachment** (3 tests): AttachmentBuilder creation

**Example:**
```typescript
it('should set emoji thumbnail when useEmoji is true', () => {
    const embed = createDyeEmbed(mockDye, false, true);
    expect(embed.data.thumbnail?.url).toContain('dye_5730.webp');
});
```

---

## Integration Tests (140 tests)

### 4. /harmony Command (`src/commands/harmony.test.ts`) - 36 tests

Tests the color harmony generation command:
- **Input Validation** (6 tests): Hex colors, dye names, invalid inputs
- **Harmony Types** (9 tests): All 9 harmony algorithms
- **Companion Count** (4 tests): Limiting results (1-3 companions)
- **Attachments** (3 tests): Color wheel + emoji attachments
- **Error Handling** (2 tests): Graceful failures
- **Autocomplete** (6 tests): Dye name suggestions, 25-item limit
- **Embed Content** (6 tests): Base color, angles, match quality

**Example:**
```typescript
it('should generate triadic harmony', async () => {
    const interaction = createMockInteraction({
        base_color: '#FF0000',
        type: 'triadic',
    });
    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Triadic');
});
```

### 5. /match Command (`src/commands/match.test.ts`) - 34 tests

Tests the color matching command:
- **Input Validation** (6 tests): Hex, dye names, case handling
- **Match Quality Levels** (2 tests): Perfect/Excellent/Good/Fair/Approximate
- **Embed Content** (10 tests): Input/output fields, swatches
- **Emoji Attachments** (3 tests): Dye emoji thumbnails
- **Error Handling** (2 tests): Graceful failures
- **Autocomplete** (6 tests): Dye suggestions
- **Color Formatting** (4 tests): Uppercase hex, RGB/HSV formatting

**Match Quality Thresholds:**
- **Perfect**: distance = 0
- **Excellent**: distance < 10
- **Good**: distance < 25
- **Fair**: distance < 50
- **Approximate**: distance ≥ 50

### 6. /mixer Command (`src/commands/mixer.test.ts`) - 36 tests

Tests the gradient generation command:
- **Input Validation** (6 tests): Mixed hex/dye inputs
- **Steps Parameter** (4 tests): Default 5, min 2, max 10
- **Gradient Generation** (3 tests): Interpolation, dye matching
- **Embed Content** (8 tests): Start/end colors, step count
- **Gradient Image** (3 tests): PNG attachment, naming
- **Step Fields** (4 tests): Target/match colors, swatches
- **Error Handling** (2 tests): Graceful failures
- **Autocomplete** (6 tests): Works for both start_color and end_color

**Example:**
```typescript
it('should generate 5 gradient colors for 5 steps', async () => {
    const interaction = createMockInteraction({
        start_color: '#FF0000',
        end_color: '#0000FF',
        steps: 5,
    });
    await execute(interaction);

    const fields = embed.data.fields || [];
    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    expect(stepFields.length).toBe(5);
});
```

### 7. /comparison Command (`src/commands/comparison.test.ts`) - 34 tests

Tests the side-by-side dye comparison command:
- **Input Validation** (8 tests): 2-4 dyes, mixed inputs
- **Dye Count** (4 tests): Correct field counts
- **Comparison Analysis** (5 tests): Most similar/different, average distance
- **Embed Content** (5 tests): Numbered emojis, dye info
- **Swatch Grid Image** (3 tests): Grid attachment
- **Error Handling** (2 tests): Graceful failures
- **Autocomplete** (7 tests): Works for all 4 dye parameters

**Quality Labels:**
- **Identical**: 0
- **Very Similar**: < 10
- **Similar**: < 25
- **Somewhat Different**: < 50
- **Different**: < 100
- **Very Different**: ≥ 100

---

## Parity Tests (27 tests)

### 8. Core Package Parity (`src/__tests__/parity.test.ts`) - 27 tests

Ensures Discord bot produces identical results to web app:
- **Color Conversions** (4 tests): hex/RGB/HSV conversions
- **Color Distance** (2 tests): Euclidean distance, symmetry
- **Dye Matching** (2 tests): Exact matches, consistency
- **Harmony Generation** (9 tests): All 9 harmony types
- **Dye Database** (6 tests): 136 dyes, properties, uniqueness
- **Specific Known Results** (4 tests): Expected outputs

**Example:**
```typescript
it('should convert hex to RGB identically', () => {
    const testCases = [
        { hex: '#FF0000', expected: { r: 255, g: 0, b: 0 } },
        { hex: '#00FF00', expected: { r: 0, g: 255, b: 0 } },
    ];
    testCases.forEach(({ hex, expected }) => {
        const result = ColorService.hexToRgb(hex);
        expect(result).toEqual(expected);
    });
});
```

**Why Parity Tests Matter:**
Both the Discord bot and web app use `xivdyetools-core`, ensuring:
- ✅ Same harmony algorithms
- ✅ Same dye database (136 dyes)
- ✅ Same color conversions
- ✅ Consistent user experience

---

## Running Tests

### All Tests
```bash
npm test                 # Run all 280 tests
npm run test:watch      # Watch mode (auto-rerun)
```

### Specific Test Files
```bash
npm test validators     # Run validator tests
npm test harmony        # Run /harmony command tests
npm test parity         # Run parity tests
```

### With Coverage
```bash
npm test -- --coverage
```

Coverage reports are generated in:
- `coverage/index.html` (HTML report - open in browser)
- `coverage/coverage-final.json` (JSON report)
- Terminal output (text summary)

### Test Output
```
Test Files  8 passed (8)
     Tests  280 passed (280)
  Start at  18:44:45
  Duration  2.74s
```

---

## Writing New Tests

### Unit Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from './yourModule.js';

describe('YourModule', () => {
    it('should do something specific', () => {
        const result = yourFunction(input);
        expect(result).toBe(expected);
    });
});
```

### Integration Test with Mocked Interaction
```typescript
import { vi } from 'vitest';
import { execute } from './command.js';
import type { ChatInputCommandInteraction } from 'discord.js';

function createMockInteraction(options): ChatInputCommandInteraction {
    return {
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        options: {
            getString: vi.fn((name) => options[name]),
        },
    } as unknown as ChatInputCommandInteraction;
}

it('should execute command successfully', async () => {
    const interaction = createMockInteraction({
        color: '#FF0000',
    });

    await execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
});
```

---

## Test Organization

```
xivdyetools-discord-bot/
├── src/
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── validators.test.ts        ✓ 30 tests
│   │   ├── emoji.ts
│   │   ├── emoji.test.ts             ✓ 19 tests
│   │   ├── embed-builder.ts
│   │   └── embed-builder.test.ts     ✓ 64 tests
│   ├── commands/
│   │   ├── harmony.ts
│   │   ├── harmony.test.ts           ✓ 36 tests
│   │   ├── match.ts
│   │   ├── match.test.ts             ✓ 34 tests
│   │   ├── mixer.ts
│   │   ├── mixer.test.ts             ✓ 36 tests
│   │   ├── comparison.ts
│   │   └── comparison.test.ts        ✓ 34 tests
│   └── __tests__/
│       └── parity.test.ts            ✓ 27 tests
├── vitest.config.ts                   (Test configuration)
└── package.json                       (Test scripts)
```

**Test Location Convention:**
- **Unit tests**: Co-located with source files (`*.test.ts`)
- **Integration tests**: Co-located with command files
- **Parity tests**: In `src/__tests__/` directory

---

## Best Practices

### ✅ DO
- ✅ Test both success and failure cases
- ✅ Use descriptive test names (`should do X when Y`)
- ✅ Mock Discord.js interactions
- ✅ Test edge cases (empty strings, null, undefined)
- ✅ Verify error messages, not just error existence
- ✅ Test autocomplete for all parameters
- ✅ Use `toBeCloseTo()` for floating point comparisons

### ❌ DON'T
- ❌ Skip test isolation (each test should be independent)
- ❌ Mock xivdyetools-core (we want real algorithm tests)
- ❌ Test implementation details (test behavior)
- ❌ Hardcode expected hex values (use dye names for exact matches)
- ❌ Batch assertions (one assertion per test when possible)

---

## Common Test Patterns

### Testing Hex Color Inputs
```typescript
it('should accept lowercase hex colors', async () => {
    const interaction = createMockInteraction('#ff0000');
    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
});
```

### Testing Dye Name Inputs
```typescript
it('should accept case-insensitive dye names', async () => {
    const interaction = createMockInteraction('dalamud red');
    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Dalamud Red');
});
```

### Testing Error Handling
```typescript
it('should reject invalid input', async () => {
    const interaction = createMockInteraction('Invalid!!!');
    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.title).toContain('Invalid Input');
});
```

### Testing Autocomplete
```typescript
it('should return dye suggestions', async () => {
    const interaction = createMockAutocompleteInteraction({
        name: 'color',
        value: 'red',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
    expect(respondCall.length).toBeLessThanOrEqual(25);
});
```

---

## CI/CD Integration (Future)

### GitHub Actions (Planned)
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

### Pre-commit Hook (Recommended)
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test && npm run lint"
    }
  }
}
```

---

## Troubleshooting

### Tests Fail with "Cannot find module"
**Solution**: Ensure you're using `.js` extensions in imports:
```typescript
// ✅ Correct
import { execute } from './harmony.js';

// ❌ Wrong
import { execute } from './harmony';
```

### Segmentation Fault After Tests Complete
**Issue**: Sharp/Canvas native modules crash during cleanup (Windows)
**Impact**: None - tests have already passed
**Solution**: This is a known issue, can be ignored

### Tests Hang or Timeout
**Solution**: Check for missing `await` in async tests:
```typescript
// ✅ Correct
it('should execute', async () => {
    await execute(interaction);
    expect(...);
});

// ❌ Wrong (will timeout)
it('should execute', async () => {
    execute(interaction); // Missing await!
    expect(...);
});
```

### Mock Interaction Not Working
**Solution**: Ensure all required methods are mocked:
```typescript
const mockInteraction = {
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deferred: true,
    options: { ... },
} as unknown as ChatInputCommandInteraction;
```

---

## Test Statistics

### Coverage by Category
| Category | Files | Tests | Lines | Coverage |
|----------|-------|-------|-------|----------|
| Validators | 1 | 30 | ~200 | ~95% |
| Emoji Utils | 1 | 19 | ~150 | ~90% |
| Embed Builder | 1 | 64 | ~400 | ~95% |
| Commands | 4 | 140 | ~1200 | ~85% |
| Parity | 1 | 27 | ~400 | 100% |

### Test Execution Speed
- **Total Duration**: ~2-3 seconds for all 280 tests
- **Fastest**: Unit tests (~50-100ms)
- **Slowest**: Integration tests with image rendering (~500-700ms)

---

## Future Improvements

### Planned
- [ ] Performance benchmarks for image renderers
- [ ] E2E tests with real Discord API (staging bot)
- [ ] Visual regression testing for generated images
- [ ] Snapshot testing for embed structures
- [ ] Load testing for concurrent command execution

### Nice to Have
- [ ] Mutation testing (Stryker)
- [ ] Property-based testing (fast-check)
- [ ] Test data generators for dyes
- [ ] Mock Discord gateway events

---

## Related Documentation

- [xivdyetools-core README](../../xivdyetools-core/README.md) - Core package API
- [PROGRESS.md](./PROGRESS.md) - Development roadmap
- [Vitest Documentation](https://vitest.dev/) - Test framework
- [Discord.js Guide](https://discordjs.guide/) - Discord API

---

## Changelog

### 2025-11-23 - Initial Test Suite
- ✅ Added 280 comprehensive tests
- ✅ 100% command coverage (4/4 commands)
- ✅ Unit, integration, and parity test coverage
- ✅ Vitest configuration with coverage reporting
- ✅ All tests passing

---

**Maintained by**: XIV Dye Tools Team
**Last Updated**: November 23, 2025
**Test Count**: 280 tests (100% passing)
