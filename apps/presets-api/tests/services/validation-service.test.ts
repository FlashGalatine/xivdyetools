import { describe, it, expect } from 'vitest';
import {
  validateSecondaryCategories,
  SECONDARY_CATEGORY_MAX,
  validatePresetName,
  validatePresetDescription,
  validatePresetTags,
} from '../../src/services/validation-service';

// FINDING-019 / FINDING-028 (2026-08-21 security audit): name, description and
// tags were length-checked only. A control character in a name broke the bot's
// SVG card render (resvg rejects XML-illegal code points) and tags carried
// arbitrary markdown into Discord embeds. Every forbidden code point below is
// written as a \uXXXX escape on purpose — the characters are invisible.
describe('validatePresetName — character rules (FINDING-028)', () => {
  it('accepts ordinary names in every supported script, with punctuation and emoji', () => {
    expect(validatePresetName('Midnight Gothic')).toBeNull();
    expect(validatePresetName('Café-Noir (v2)')).toBeNull();
    expect(validatePresetName('紅葉の庭')).toBeNull();
    expect(validatePresetName('밤하늘 팔레트')).toBeNull();
    expect(validatePresetName('Sunset \u{1F305} vibes')).toBeNull();
    // Emoji ZWJ sequences are legitimate uses of U+200D: rainbow flag, family
    expect(validatePresetName('Pride \u{1F3F3}️\u200d\u{1F308} palette')).toBeNull();
    expect(
      validatePresetName('Family \u{1F468}\u200d\u{1F469}\u200d\u{1F467} colours')
    ).toBeNull();
    // skin-tone modifier + ZWJ (astronaut)
    expect(validatePresetName('Space \u{1F9D1}\u{1F3FD}\u200d\u{1F680} palette')).toBeNull();
    // ZWJ followed by a BMP symbol (woman running: runner + ZWJ + female sign)
    expect(validatePresetName('Run \u{1F3C3}\u200d♀️ palette')).toBeNull();
  });

  it('rejects C0 control characters, DEL and C1 controls', () => {
    expect(validatePresetName('Hello\u0007World')).toContain('unsupported characters'); // BEL
    expect(validatePresetName('Hello\u0000World')).toContain('unsupported characters'); // NUL
    expect(validatePresetName('Hello\u001bWorld')).toContain('unsupported characters'); // ESC
    expect(validatePresetName('Hello\u007fWorld')).toContain('unsupported characters'); // DEL
    expect(validatePresetName('Hello\u0085World')).toContain('unsupported characters'); // NEL (C1)
    expect(validatePresetName('Hello\u009fWorld')).toContain('unsupported characters'); // APC (C1)
  });

  it('rejects line breaks and tabs — a name is a single line', () => {
    expect(validatePresetName('Two\nlines here')).toContain('unsupported characters');
    expect(validatePresetName('Tab\tbed name')).toContain('unsupported characters');
    expect(validatePresetName('Carriage\rreturn')).toContain('unsupported characters');
  });

  it('rejects zero-width, bidi-override and bidi-isolate characters', () => {
    expect(validatePresetName('Ad\u200bmin palette')).toContain('unsupported characters'); // ZWSP
    expect(validatePresetName('Ad\u200cmin palette')).toContain('unsupported characters'); // ZWNJ
    expect(validatePresetName('Ad\u200emin palette')).toContain('unsupported characters'); // LRM
    expect(validatePresetName('Ad\u200fmin palette')).toContain('unsupported characters'); // RLM
    expect(validatePresetName('Ad\u202amin palette')).toContain('unsupported characters'); // LRE
    expect(validatePresetName('Ad\u202emin palette')).toContain('unsupported characters'); // RLO
    expect(validatePresetName('Ad\u2066min palette')).toContain('unsupported characters'); // LRI
    expect(validatePresetName('Ad\u2069min palette')).toContain('unsupported characters'); // PDI
    expect(validatePresetName('\ufeffBOM palette')).toContain('unsupported characters'); // ZWNBSP
    expect(validatePresetName('Line\u2028sep palette')).toContain('unsupported characters');
    expect(validatePresetName('Para\u2029sep palette')).toContain('unsupported characters');
  });

  it('rejects a zero-width joiner outside an emoji sequence', () => {
    expect(validatePresetName('Ad\u200dmin palette')).toContain('unsupported characters');
    expect(validatePresetName('Trailing\u200d')).toContain('unsupported characters');
    expect(validatePresetName('\u200dLeading')).toContain('unsupported characters');
    // an emoji on one side only is not a sequence either
    expect(validatePresetName('Fire \u{1F525}\u200dx palette')).toContain('unsupported characters');
    expect(validatePresetName('Fire x\u200d\u{1F525} palette')).toContain('unsupported characters');
  });

  it('keeps the length rule and its original message', () => {
    expect(validatePresetName('A')).toBe('Name must be 2-50 characters');
    expect(validatePresetName('A'.repeat(51))).toBe('Name must be 2-50 characters');
    expect(validatePresetName(42)).toBe('Name is required');
  });
});

describe('validatePresetDescription — character rules (FINDING-028)', () => {
  it('allows line breaks and tabs — descriptions are multi-line', () => {
    expect(validatePresetDescription('First line of the story.\nSecond line here.')).toBeNull();
    expect(validatePresetDescription('Windows line\r\nbreaks are fine too.')).toBeNull();
    expect(validatePresetDescription('Tabbed\tdescription that is long.')).toBeNull();
  });

  it('accepts emoji ZWJ sequences like the name rule does', () => {
    expect(
      validatePresetDescription('A proud palette \u{1F3F3}️\u200d\u{1F308} for everyone.')
    ).toBeNull();
  });

  it('rejects other control characters and invisible characters', () => {
    expect(validatePresetDescription('A calm palette \u0007 with a bell.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm palette \u0000 with a NUL.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm palette \u000b with a VT.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm palette \u007f with DEL.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm palette \u0085 with C1.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm\u200b palette with ZWSP.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm\u202e palette with RLO.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('\ufeffA calm palette with a BOM.')).toContain(
      'unsupported characters'
    );
    expect(validatePresetDescription('A calm\u200d palette with a stray ZWJ.')).toContain(
      'unsupported characters'
    );
  });

  it('keeps the length rule and its original message', () => {
    expect(validatePresetDescription('short')).toBe('Description must be 10-200 characters');
    expect(validatePresetDescription('x'.repeat(201))).toBe('Description must be 10-200 characters');
    expect(validatePresetDescription(null)).toBe('Description is required');
  });
});

describe('validatePresetTags — charset rules (FINDING-019)', () => {
  it('accepts letters, digits, spaces, hyphens, underscores and apostrophes', () => {
    expect(
      validatePresetTags([
        'dark',
        'Gothic Noir',
        "90's",
        'rock’n’roll',
        'night_elf',
        'blue-green',
        'Level80',
        '紅葉',
        'ナイト',
        'Nacht',
      ])
    ).toBeNull();
  });

  it('accepts letters carrying combining marks', () => {
    // "é" written as e + COMBINING ACUTE ACCENT (decomposed form)
    expect(validatePresetTags(['cafe\u0301'])).toBeNull();
  });

  it('accepts an empty list', () => {
    expect(validatePresetTags([])).toBeNull();
  });

  it('rejects markdown, links and other punctuation', () => {
    const error = validatePresetTags(['[Verify bot](https://evil.tld)']);
    expect(error).toContain('letters, numbers, spaces, hyphens, underscores and apostrophes');
    expect(validatePresetTags(['#tag'])).not.toBeNull();
    expect(validatePresetTags(['tag!'])).not.toBeNull();
    expect(validatePresetTags(['`code`'])).not.toBeNull();
    expect(validatePresetTags(['a*b'])).not.toBeNull();
    expect(validatePresetTags(['a|b'])).not.toBeNull();
    expect(validatePresetTags(['<slur>'])).not.toBeNull();
    expect(validatePresetTags(['dark,gothic'])).not.toBeNull();
    expect(validatePresetTags(['https://evil.tld'])).not.toBeNull();
  });

  it('rejects empty tags and leading/trailing separators', () => {
    expect(validatePresetTags([''])).not.toBeNull();
    expect(validatePresetTags([' dark'])).not.toBeNull();
    expect(validatePresetTags(['dark '])).not.toBeNull();
    expect(validatePresetTags(['-dark'])).not.toBeNull();
    expect(validatePresetTags(['dark-'])).not.toBeNull();
    expect(validatePresetTags(["'dark"])).not.toBeNull();
    expect(validatePresetTags(['_'])).not.toBeNull();
  });

  it('rejects control and invisible characters inside a tag', () => {
    expect(validatePresetTags(['da\u0007rk'])).not.toBeNull();
    expect(validatePresetTags(['da\u200brk'])).not.toBeNull();
    expect(validatePresetTags(['da\u202erk'])).not.toBeNull();
    expect(validatePresetTags(['da\nrk'])).not.toBeNull();
    expect(validatePresetTags(['da\u200drk'])).not.toBeNull();
  });

  it('keeps the existing structural rules and messages', () => {
    expect(validatePresetTags('dark')).toBe('Tags must be an array');
    expect(validatePresetTags(Array.from({ length: 11 }, (_, i) => `tag${i}`))).toBe(
      'Maximum 10 tags allowed'
    );
    expect(validatePresetTags(['a'.repeat(31)])).toBe(
      'Each tag must be a string of max 30 characters'
    );
    expect(validatePresetTags([42])).toBe('Each tag must be a string of max 30 characters');
  });
});

const VALID = ['jobs', 'seasons', 'events', 'aesthetics', 'appearance', 'zones', 'raids-trials'];

describe('validateSecondaryCategories', () => {
  it('accepts undefined — the field is optional', () => {
    expect(validateSecondaryCategories(undefined, 'jobs', VALID)).toBeNull();
  });

  it('accepts an empty array — that is how a caller clears the list', () => {
    expect(validateSecondaryCategories([], 'jobs', VALID)).toBeNull();
  });

  it('accepts up to the cap', () => {
    expect(validateSecondaryCategories(['seasons', 'zones'], 'jobs', VALID)).toBeNull();
    expect(SECONDARY_CATEGORY_MAX).toBe(2);
  });

  it('rejects more than the cap', () => {
    const error = validateSecondaryCategories(['seasons', 'zones', 'events'], 'jobs', VALID);
    expect(error).toContain('at most 2');
  });

  it('rejects a non-array', () => {
    expect(validateSecondaryCategories('seasons', 'jobs', VALID)).toContain('must be an array');
  });

  it('rejects an unknown category id', () => {
    expect(validateSecondaryCategories(['dungeons'], 'jobs', VALID)).toContain('Invalid');
  });

  it('rejects duplicates within the list', () => {
    expect(validateSecondaryCategories(['zones', 'zones'], 'jobs', VALID)).toContain('duplicate');
  });

  it('rejects the primary appearing as a secondary', () => {
    expect(validateSecondaryCategories(['jobs'], 'jobs', VALID)).toContain('primary');
  });
});
