/**
 * Palette export — the one place a palette becomes text.
 *
 * Four tools produce something exportable (Extractor's roll, Gradient's ramp,
 * Comparison's set, Mixer's blend) and before 5.0 each either hand-rolled its
 * own string or had no export at all. The 3C/4C specs asked for "Export CSS in
 * the header (shared with Gradient)" — shared being the operative word, so the
 * generators live here as pure functions and the tools only supply data.
 *
 * Every entry carries BOTH colours: the source (the pixel sampled, the ideal
 * interpolated step, the blend) and the dye it resolved to. Divergence is the
 * interesting part of this app's output, so the export shows it rather than
 * silently publishing whichever one happened to win.
 *
 * Pure by design — no DOM, no services — so the formats are unit-testable
 * without a browser.
 *
 * @module shared/palette-export
 */

import type { Dye } from '@xivdyetools/types';

/** Formats offered by the export sheet. */
export type ExportFormat = 'css' | 'scss' | 'json' | 'hex' | 'tailwind';

/** Every format, in the order the switcher renders them. */
export const EXPORT_FORMATS: ExportFormat[] = ['css', 'scss', 'json', 'hex', 'tailwind'];

/** Display name for a format chip. Format names are proper nouns — not translated. */
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  hex: 'HEX',
  tailwind: 'Tailwind',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  css: 'css',
  scss: 'scss',
  json: 'json',
  hex: 'txt',
  tailwind: 'css',
};

const MIME_TYPES: Record<ExportFormat, string> = {
  css: 'text/css',
  scss: 'text/scss',
  json: 'application/json',
  hex: 'text/plain',
  tailwind: 'text/css',
};

/** One exportable pairing: a source colour and/or the dye it resolved to. */
export interface ExportEntry {
  /**
   * Slug base for generated identifiers — `pick-1`, `step-3`, `dye-2`.
   * Deliberately positional: no dye name ever reaches an identifier, so a
   * localised name can never strip to an empty (and invalid) `--dye-:`.
   */
  key: string;
  /** The source colour: sampled pixel, ideal ramp step, blended mix. */
  source?: string | null;
  /** The dye the source resolved to, when there is one. */
  dye?: Dye | null;
  /** ΔE between source and dye, when the pairing is a real match. */
  delta?: number | null;
}

/** Everything a tool hands the exporter. */
export interface ExportPayload {
  /** Tool slug — used for the filename. */
  tool: string;
  /** Human title for the header comment. */
  title: string;
  entries: ExportEntry[];
  /** Extra header lines: blend model, interpolation space, step count. */
  meta?: string[];
}

/** Normalise a hex string to uppercase `#RRGGBB`. */
function normalizeHex(hex: string): string {
  return hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
}

/** ISO date (yyyy-mm-dd) used in headers and filenames. */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * The per-entry annotation shared by every commented format: which dye it is,
 * its canonical stainID, and how far the match drifted.
 */
function describeEntry(entry: ExportEntry): string {
  const parts: string[] = [];
  if (entry.dye) {
    parts.push(entry.dye.name);
    if (typeof entry.dye.stainID === 'number') parts.push(`stainID ${entry.dye.stainID}`);
  }
  if (typeof entry.delta === 'number' && Number.isFinite(entry.delta)) {
    parts.push(`ΔE ${entry.delta.toFixed(1)}`);
  }
  return parts.join(' · ');
}

/**
 * Suffix for a generated identifier. The `-source` / `-dye` pair only earns its
 * keep when both halves are present; a Comparison entry has no source, and
 * `--dye-1-dye` is just a stutter. One half → the bare key.
 */
function suffix(entry: ExportEntry, half: 'source' | 'dye'): string {
  return entry.source && entry.dye ? `-${half}` : '';
}

/** Header lines shared by all commented formats, without comment markers. */
function headerLines(payload: ExportPayload): string[] {
  const lines = [
    `XIV Dye Tools — ${payload.title}`,
    `Generated ${today()} · ${payload.entries.length} ${payload.entries.length === 1 ? 'entry' : 'entries'}`,
  ];
  if (payload.meta?.length) lines.push(...payload.meta);
  return lines;
}

function generateCss(payload: ExportPayload): string {
  const head = headerLines(payload)
    .map((line) => ` * ${line}`)
    .join('\n');
  const body = payload.entries
    .map((entry) => {
      const lines: string[] = [];
      const note = describeEntry(entry);
      lines.push(`  /* ${entry.key}${note ? ` — ${note}` : ''} */`);
      if (entry.source) {
        lines.push(`  --${entry.key}${suffix(entry, 'source')}: ${normalizeHex(entry.source)};`);
      }
      if (entry.dye) {
        lines.push(`  --${entry.key}${suffix(entry, 'dye')}: ${normalizeHex(entry.dye.hex)};`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
  return `/**\n${head}\n */\n\n:root {\n${body}\n}\n`;
}

function generateScss(payload: ExportPayload): string {
  const head = headerLines(payload)
    .map((line) => `// ${line}`)
    .join('\n');
  const body = payload.entries
    .map((entry) => {
      const lines: string[] = [];
      const note = describeEntry(entry);
      lines.push(`// ${entry.key}${note ? ` — ${note}` : ''}`);
      if (entry.source) {
        lines.push(`$${entry.key}${suffix(entry, 'source')}: ${normalizeHex(entry.source)};`);
      }
      if (entry.dye) {
        lines.push(`$${entry.key}${suffix(entry, 'dye')}: ${normalizeHex(entry.dye.hex)};`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
  return `${head}\n\n${body}\n`;
}

/**
 * Tailwind 4 reads design tokens straight out of an `@theme` block, and only
 * `--color-*` names become colour utilities — hence the prefix.
 */
function generateTailwind(payload: ExportPayload): string {
  const head = headerLines(payload)
    .map((line) => ` * ${line}`)
    .join('\n');
  const body = payload.entries
    .map((entry) => {
      const lines: string[] = [];
      const note = describeEntry(entry);
      lines.push(`  /* ${entry.key}${note ? ` — ${note}` : ''} */`);
      if (entry.source) {
        lines.push(
          `  --color-${entry.key}${suffix(entry, 'source')}: ${normalizeHex(entry.source)};`
        );
      }
      if (entry.dye) {
        lines.push(
          `  --color-${entry.key}${suffix(entry, 'dye')}: ${normalizeHex(entry.dye.hex)};`
        );
      }
      return lines.join('\n');
    })
    .join('\n\n');
  return `/**\n${head}\n */\n\n@theme {\n${body}\n}\n`;
}

function generateJson(payload: ExportPayload): string {
  return `${JSON.stringify(
    {
      tool: payload.tool,
      title: payload.title,
      generated: today(),
      ...(payload.meta?.length ? { meta: payload.meta } : {}),
      entries: payload.entries.map((entry) => ({
        key: entry.key,
        ...(entry.source ? { source: normalizeHex(entry.source) } : {}),
        ...(entry.dye
          ? {
              dye: {
                stainID: entry.dye.stainID,
                name: entry.dye.name,
                hex: normalizeHex(entry.dye.hex),
              },
            }
          : {}),
        ...(typeof entry.delta === 'number' && Number.isFinite(entry.delta)
          ? { deltaE: Number(entry.delta.toFixed(2)) }
          : {}),
      })),
    },
    null,
    2
  )}\n`;
}

/**
 * Plain text, split into two pasteable columns rather than interleaved — a
 * list of hexes is only useful if you can select the half you actually want.
 */
function generateHex(payload: ExportPayload): string {
  const sources = payload.entries
    .map((entry) => entry.source)
    .filter((hex): hex is string => Boolean(hex))
    .map(normalizeHex);
  const dyes = payload.entries
    .map((entry) => entry.dye?.hex)
    .filter((hex): hex is string => Boolean(hex))
    .map(normalizeHex);

  const blocks: string[] = [];
  if (sources.length) blocks.push(`Source\n${sources.join('\n')}`);
  if (dyes.length) blocks.push(`Dyes\n${dyes.join('\n')}`);
  return `${blocks.join('\n\n')}\n`;
}

/** Render a payload in the requested format. */
export function generateExport(payload: ExportPayload, format: ExportFormat): string {
  switch (format) {
    case 'css':
      return generateCss(payload);
    case 'scss':
      return generateScss(payload);
    case 'json':
      return generateJson(payload);
    case 'hex':
      return generateHex(payload);
    case 'tailwind':
      return generateTailwind(payload);
  }
}

/** Filename for a downloaded export. */
export function exportFilename(payload: ExportPayload, format: ExportFormat): string {
  return `xiv-${payload.tool}-${today()}.${EXTENSIONS[format]}`;
}

/** MIME type for a downloaded export. */
export function exportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}
