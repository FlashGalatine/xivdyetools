import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const stockBytes = readFileSync(require.resolve('@cf-wasm/photon/photon.wasm'));
const candidateBytes = readFileSync(new URL('../vendor/photon/photon-owned.wasm', import.meta.url));
const expectedHash = 'dd3badf24c0231a0b9b63272829d714c7d5feccccd9f2ebdd76c61b5fc6f1bd1';
const vendorDir = new URL('../vendor/photon/', import.meta.url);
const manifestBytes = readFileSync(new URL('retention-manifest.json', vendorDir));
// Pins the manifest itself, so a file cannot be swapped together with its recorded hash.
const expectedManifestHash = '78e3ed2679335f358994962786f112c907b0b0ca8754088b3d9531622d657552';
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
interface RetainedFile { path: string; bytes: number; retainedSHA256: string }
const retained = (JSON.parse(manifestBytes.toString('utf8')) as { files: RetainedFile[] }).files;
const byPath = new Map(retained.map((file) => [file.path, file]));
const BUILD_INPUTS = ['source-patched.tar.gz', 'source-unmodified.tar.gz', 'ownership.patch', 'Cargo.lock',
  'build.ps1', 'photon-owned.wasm', 'provenance.json', 'abi-signatures.json', 'LICENSE.md',
  'notice-rebuild-2026-10-31.json'];
// Current-context files outside the retained set (vendor/photon/README.md says why).
const NOT_RETAINED = new Set(['.gitignore', 'README.md', 'retention-manifest.json']);
// Mirrors vendor/photon/.gitignore: local build outputs and the isolated toolchain.
const LOCAL_BUILD_DIR = /^(source|artifacts|logs|toolchain|target-.*)$/;
// Workers type declarations prohibit runtime compilation; this test runs in Node.
const NodeModule = WebAssembly.Module as unknown as { new(bytes: Uint8Array): WebAssembly.Module };

interface Signature {
  parameters: number[];
  results: number[];
}

/** Read function types as well as the names/kinds exposed by the engine API. */
function functionAbi(bytes: Uint8Array) {
  let offset = 8;
  const types: Signature[] = [];
  const functions: number[] = [];
  const imports: { module: string; name: string; kind: string; signature: Signature }[] = [];
  const exports: { name: string; kind: number; signature?: Signature }[] = [];
  const byte = (): number => {
    const value = bytes[offset++];
    if (value === undefined) throw new Error('Truncated WASM section');
    return value;
  };
  const uint = (): number => {
    let value = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const next = byte();
      value |= (next & 127) << shift;
      if (!(next & 128)) return value >>> 0;
    }
    throw new Error('Invalid WASM u32');
  };
  const string = (): string => {
    const size = uint();
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset, offset + size));
    offset += size;
    return value;
  };
  const values = (): number[] => Array.from({ length: uint() }, () => {
    const value = byte();
    if (![0x7f, 0x7e, 0x7d, 0x7c, 0x7b, 0x70, 0x6f].includes(value)) {
      throw new Error('Unsupported WASM value type');
    }
    return value;
  });
  const signature = (typeIndex: number | undefined): Signature => {
    const value = typeIndex === undefined ? undefined : types[typeIndex];
    if (!value) throw new Error('Missing WASM function type');
    return value;
  };
  while (offset < bytes.length) {
    const section = byte();
    const size = uint();
    const end = offset + size;
    if (end > bytes.length) throw new Error('Truncated WASM section');
    if (section === 1) {
      const count = uint();
      for (let i = 0; i < count; i++) {
        if (byte() !== 0x60) throw new Error('Unsupported WASM type');
        types.push({ parameters: values(), results: values() });
      }
    } else if (section === 2) {
      const count = uint();
      for (let i = 0; i < count; i++) {
        const module = string();
        const name = string();
        if (byte() !== 0) throw new Error('Unexpected non-function WASM import');
        const typeIndex = uint();
        functions.push(typeIndex);
        imports.push({ module, name, kind: 'function', signature: signature(typeIndex) });
      }
    } else if (section === 3) {
      const count = uint();
      for (let i = 0; i < count; i++) functions.push(uint());
    } else if (section === 7) {
      const count = uint();
      for (let i = 0; i < count; i++) {
        const name = string();
        const kind = byte();
        const index = uint();
        exports.push({ name, kind, ...(kind === 0 ? { signature: signature(functions[index]) } : {}) });
      }
    }
    if (offset > end) throw new Error('Invalid WASM section size');
    offset = end;
  }
  return {
    imports: imports.sort((a, b) => (a.module + a.name).localeCompare(b.module + b.name)),
    exports: exports.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

describe('retained Photon ownership artifact', () => {
  it('rejects an accidental stock or stale ownership binary', () => {
    expect(createHash('sha256').update(candidateBytes).digest('hex')).toBe(expectedHash);
  });

  it('keeps the reviewed stock wrapper version exact', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(manifest.dependencies['@cf-wasm/photon']).toBe('0.4.0');
    const installed = JSON.parse(readFileSync(require.resolve('@cf-wasm/photon/package.json'), 'utf8'));
    expect(installed.version).toBe('0.4.0');
  });

  it('is engine-parseable and preserves every stock import and export', () => {
    const stock = new NodeModule(stockBytes);
    const candidate = new NodeModule(candidateBytes);
    const sorted = <T>(items: T[]): T[] => items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(sorted(WebAssembly.Module.imports(candidate))).toEqual(sorted(WebAssembly.Module.imports(stock)));
    expect(sorted(WebAssembly.Module.exports(candidate))).toEqual(sorted(WebAssembly.Module.exports(stock)));
  });

  it('preserves all stock function parameter and result signatures', () => {
    const candidate = functionAbi(candidateBytes);
    const stock = functionAbi(stockBytes);
    const receipt = JSON.parse(readFileSync(new URL('../vendor/photon/abi-signatures.json', import.meta.url), 'utf8'));
    expect(candidate).toEqual(stock);
    expect(candidate).toEqual(receipt.variants.resize.abi);
    expect(stock).toEqual(receipt.installed);
  });

  it('pins the retention manifest', () => {
    expect(sha256(manifestBytes)).toBe(expectedManifestHash);
  });

  it('records every build input and the accepted artifact', () => {
    for (const path of BUILD_INPUTS) expect(byPath.has(path), path).toBe(true);
    expect(byPath.get('photon-owned.wasm')?.retainedSHA256).toBe(expectedHash);
  });

  it('matches every retained file byte-for-byte', () => {
    const bad = retained.filter((file) => {
      const bytes = readFileSync(new URL(file.path, vendorDir));
      return bytes.length !== file.bytes || sha256(bytes) !== file.retainedSHA256;
    }).map((file) => file.path);
    expect(bad).toEqual([]);
  });

  it('keeps the 2026-10-31 rebuild proof consistent with the retained inputs', () => {
    const proof = JSON.parse(readFileSync(new URL('notice-rebuild-2026-10-31.json', vendorDir), 'utf8'));
    const archive = sha256(readFileSync(new URL('source-patched.tar.gz', vendorDir)));
    expect(proof.noticeRebuild.sourceArchiveSHA256).toBe(archive);
    expect(proof.sourceChange.sourceArchive.sha256).toBe(byPath.get('source-patched.tar.gz')?.retainedSHA256);
    expect(proof.sourceChange.ownershipPatch.sha256).toBe(byPath.get('ownership.patch')?.retainedSHA256);
    expect(proof.buildScript.retainedSHA256).toBe(byPath.get('build.ps1')?.retainedSHA256);
    expect([proof.noticeRebuild.acceptedWasmSHA256, proof.noticeRebuild.artifacts['photon_rs_bg.wasm']])
      .toEqual([expectedHash, expectedHash]);
  });

  it('retains no unrecorded vendor file', () => {
    const root = fileURLToPath(vendorDir);
    const present: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
        const path = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (!(relative === '' && LOCAL_BUILD_DIR.test(entry.name))) walk(path);
        } else if (statSync(join(root, path)).isFile()) {
          present.push(path);
        }
      }
    };
    walk('');
    expect(present.filter((path) => !byPath.has(path) && !NOT_RETAINED.has(path)).sort()).toEqual([]);
  });

  it('uses the stock wrapper with the owned artifact for pixel operations and round-trip decode', async () => {
    // Node supplies the compiled module that Wrangler's WASM-module import provides.
    // The shim and stock JS wrapper remain real; no Node memory claim is made here.
    vi.doMock('../vendor/photon/photon-owned.wasm', () => ({ default: new NodeModule(candidateBytes) }));
    const runtime = await import('./photon-runtime.js');
    expect(Object.keys(runtime).sort()).toEqual(['PhotonImage', 'SamplingFilter', 'crop', 'resize']);
    const original = new runtime.PhotonImage(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]), 2, 1);
    try {
      const cropped = runtime.crop(original, 1, 0, 2, 1);
      try {
        expect(cropped).toBeInstanceOf(runtime.PhotonImage);
        expect([cropped.get_width(), cropped.get_height()]).toEqual([1, 1]);
        expect(cropped.get_raw_pixels()).toEqual(new Uint8Array([0, 255, 0, 128]));
      } finally { cropped.free(); }
      const resized = runtime.resize(original, 4, 2, runtime.SamplingFilter.Nearest);
      try {
        expect(resized).toBeInstanceOf(runtime.PhotonImage);
        expect([resized.get_width(), resized.get_height()]).toEqual([4, 2]);
        expect(resized.get_raw_pixels()).toEqual(new Uint8Array([
          255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 128, 0, 255, 0, 128,
          255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 128, 0, 255, 0, 128,
        ]));
      } finally { resized.free(); }
      const decoded = runtime.PhotonImage.new_from_byteslice(original.get_bytes());
      try {
        expect(decoded).toBeInstanceOf(runtime.PhotonImage);
        expect([decoded.get_width(), decoded.get_height()]).toEqual([2, 1]);
        expect(decoded.get_raw_pixels()).toEqual(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]));
      } finally { decoded.free(); }
    } finally { original.free(); }
  });
});
