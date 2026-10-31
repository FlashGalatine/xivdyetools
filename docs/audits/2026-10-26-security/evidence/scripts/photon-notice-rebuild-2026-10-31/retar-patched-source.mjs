#!/usr/bin/env node
// Rewrites apps/image-worker/vendor/photon/source-patched.tar.gz with replacement copies of
// src/lib.rs and src/transform.rs (the 2026-10-31 Apache-2.0 section 4(b) notices), keeping
// every other tar header and payload byte-identical, so the archive is reproducible.
//
//   node retar-patched-source.mjs <input.tar.gz> <replacement-root> <output.tar.gz>
//
// <replacement-root> holds src/lib.rs and src/transform.rs. Only those two entries change:
// their payload, size, mtime (fixed to 2026-10-31T00:00:00Z) and header checksum. The output
// is gzip level 9 with header mtime 0 and OS byte 3, so a given Node/zlib pair always
// produces the same bytes (recorded in vendor/photon/notice-rebuild-2026-10-31.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const [input, replacementRoot, output] = process.argv.slice(2);
if (!input || !replacementRoot || !output) {
  console.error('usage: retar-patched-source.mjs <input.tar.gz> <replacement-root> <output.tar.gz>');
  process.exit(2);
}

const REPLACED = new Map([
  ['./src/lib.rs', 'src/lib.rs'],
  ['./src/transform.rs', 'src/transform.rs'],
]);
const MTIME = Math.floor(Date.UTC(2026, 9, 31) / 1000);
const BLOCK = 512;

const field = (header, start, length) => header.subarray(start, start + length).toString('latin1').replace(/\0.*$/s, '');
const octal = (value, width) => `${value.toString(8).padStart(width - 1, '0')}\0`;

const tar = gunzipSync(readFileSync(input));
const parts = [];
const replaced = [];
let offset = 0;
for (;;) {
  const header = tar.subarray(offset, offset + BLOCK);
  if (header.length < BLOCK) throw new Error('truncated tar header');
  if (header.every((byte) => byte === 0)) break;
  if (field(header, 257, 6) !== 'ustar') throw new Error('not a ustar entry');
  if (header.subarray(345, 500).some((byte) => byte !== 0)) throw new Error('prefix field not supported');
  const name = field(header, 0, 100);
  const size = parseInt(field(header, 124, 12).trim() || '0', 8);
  const padded = Math.ceil(size / BLOCK) * BLOCK;
  const source = REPLACED.get(name);
  if (source === undefined) {
    parts.push(tar.subarray(offset, offset + BLOCK + padded));
  } else {
    if (String.fromCharCode(header[156]) !== '0') throw new Error(`${name} is not a regular file`);
    const data = readFileSync(join(replacementRoot, source));
    const next = Buffer.from(header);
    next.write(octal(data.length, 12), 124, 'latin1');
    next.write(octal(MTIME, 12), 136, 'latin1');
    next.fill(0x20, 148, 156);
    const sum = next.reduce((total, byte) => total + byte, 0);
    next.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'latin1');
    const body = Buffer.alloc(Math.ceil(data.length / BLOCK) * BLOCK);
    data.copy(body);
    parts.push(next, body);
    replaced.push(name);
  }
  offset += BLOCK + padded;
}
if (replaced.length !== REPLACED.size) throw new Error(`replaced ${replaced.join(', ')} only`);
// Two zero blocks end the archive; the retained input carries no further record padding.
if (tar.length !== offset + 2 * BLOCK) throw new Error('unexpected trailing tar padding');
parts.push(Buffer.alloc(2 * BLOCK));

const gz = gzipSync(Buffer.concat(parts), { level: 9 });
gz.writeUInt32LE(0, 4);
gz[9] = 3;
writeFileSync(output, gz);
console.log(JSON.stringify({ replaced, node: process.version, zlib: process.versions.zlib }));
