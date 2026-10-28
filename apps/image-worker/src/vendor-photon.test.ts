import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const stockBytes = readFileSync(require.resolve('@cf-wasm/photon/photon.wasm'));
const candidateBytes = readFileSync(new URL('../vendor/photon/photon-owned.wasm', import.meta.url));
const expectedHash = 'f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461';
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
