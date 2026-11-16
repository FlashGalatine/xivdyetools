// A finite sequential loopback client. Never starts Wrangler or contacts a cloud API.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const argument = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
assert.ok(argument('session') && argument('proxy') && argument('sequence'), 'Required: --session=<prepared folder> --proxy=http://127.0.0.1:8787 --sequence=<JSON file>');
const session = path.resolve(argument('session'));
const proxy = new URL(argument('proxy'));
assert.ok(proxy.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(proxy.hostname), 'Only an HTTP loopback proxy is allowed');
assert.ok(proxy.port && proxy.pathname === '/' && !proxy.username && !proxy.password && !proxy.search && !proxy.hash, 'Proxy must be a bare loopback origin with explicit port');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const proof = JSON.parse(fs.readFileSync(path.join(session, 'provenance.json'), 'utf8'));
assert.ok(Date.now() < proof.deadline && proof.deadline - Date.now() <= 15 * 60 * 1000, 'Prepare a fresh session');
for (const [name, sha256] of Object.entries(proof.sourceHashes)) assert.equal(hash(fs.readFileSync(path.resolve(proof.sourceRoot, name))), sha256, 'Source drift');
for (const [name, sha256] of Object.entries(proof.artifacts)) assert.equal(hash(fs.readFileSync(path.join(session, name))), sha256, 'Artifact drift');
assert.match(proof.accountId ?? '', /^[a-f0-9]{32}$/, 'Missing or invalid pinned account');
const config = JSON.parse(fs.readFileSync(path.join(session, 'wrangler.json'), 'utf8'));
assert.equal(config.account_id, proof.accountId, 'Config account differs from prepared account');
assert.equal(config.name, 'xivdyetools-image-acceptance-20261028', 'Unexpected canary identity');
const token = fs.readFileSync(path.join(session, 'token.txt'), 'utf8').trim();
assert.match(token, /^[a-f0-9]{64}$/, 'Invalid session token');
const sequenceFile = path.resolve(argument('sequence'));
assert.ok(fs.statSync(sequenceFile).size <= 256 * 1024, 'Sequence manifest too large');
const sequence = JSON.parse(fs.readFileSync(sequenceFile, 'utf8'));
assert.ok(Array.isArray(sequence) && sequence.length > 0 && sequence.length <= 128, 'Sequence must contain 1..128 explicit requests');
const sha = /^[a-f0-9]{64}$/;
for (const row of sequence) {
  assert.ok(['thumbnail', 'extract'].includes(row.route));
  assert.ok(typeof row.fixture === 'string' && sha.test(row.inputSHA256) && sha.test(row.outputSHA256));
  assert.ok(Number.isInteger(row.status) && row.status >= 200 && row.status <= 599);
  assert.ok(Number.isInteger(row.responseBytes) && row.responseBytes >= 0 && row.responseBytes <= 2 * 1024 * 1024);
  assert.ok(row.maxDimension === undefined || (row.route === 'extract' && Number.isInteger(row.maxDimension) && row.maxDimension >= 1 && row.maxDimension <= 999));
  if (row.status === 200) assert.ok(Number.isInteger(row.width) && row.width > 0 && Number.isInteger(row.height) && row.height > 0, 'Successful outputs require expected dimensions');
  const target = path.resolve(path.dirname(sequenceFile), row.fixture);
  assert.ok(fs.statSync(target).size <= 5 * 1024 * 1024 + 1, 'Fixture exceeds bounded wrapper reader');
  assert.equal(hash(fs.readFileSync(target)), row.inputSHA256, 'Input fixture drift');
}

function webpDimensions(bytes) {
  assert.ok(bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', 'Expected WebP');
  for (let position = 12; position + 8 <= bytes.length;) {
    const tag = bytes.toString('ascii', position, position + 4);
    const size = bytes.readUInt32LE(position + 4);
    const start = position + 8;
    assert.ok(start + size <= bytes.length, 'Invalid WebP chunk');
    if (tag === 'VP8X' && size >= 10) return [1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)];
    if (tag === 'VP8L' && size >= 5 && bytes[start] === 0x2f) {
      const bits = bytes.readUInt32LE(start + 1);
      return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
    }
    if (tag === 'VP8 ' && size >= 10 && bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    position = start + size + (size & 1);
  }
  throw new Error('WebP dimensions unavailable');
}

async function boundedResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      assert.ok(size <= 2 * 1024 * 1024, 'Response limit exceeded');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

const receiptPath = path.join(session, 'receipts-' + Date.now() + '.json');
const result = { startedAt: new Date().toISOString(), sequenceSHA256: hash(fs.readFileSync(sequenceFile)), artifactHashes: proof.artifacts, rows: [], passed: false };
const lockPath = path.join(session, 'client-budget.lock');
const lock = fs.openSync(lockPath, 'wx');
const budgetPath = path.join(session, 'client-budget.json');
let boot;
try {
  const previous = fs.existsSync(budgetPath) ? JSON.parse(fs.readFileSync(budgetPath, 'utf8')).reservedRequests : 0;
  assert.ok(Number.isInteger(previous) && previous >= 0 && previous + sequence.length <= 128, 'Session client request budget exhausted');
  // Reserve the whole batch before dispatch; failures and interrupted runs consume their reservation.
  fs.writeFileSync(budgetPath, JSON.stringify({ reservedRequests: previous + sequence.length }) + '\n');
  for (const [index, row] of sequence.entries()) {
    assert.ok(Date.now() < proof.deadline, 'Session expired');
    const input = fs.readFileSync(path.resolve(path.dirname(sequenceFile), row.fixture));
    assert.equal(hash(input), row.inputSHA256, 'Input fixture changed');
    const url = new URL('/acceptance/' + row.route, proxy);
    if (row.maxDimension !== undefined) url.searchParams.set('maxDimension', String(row.maxDimension));
    const start = performance.now();
    // redirect:error prevents credential forwarding or any non-loopback request.
    const response = await fetch(url, { method: 'POST', body: input, redirect: 'error',
      signal: AbortSignal.timeout(Math.max(1, Math.min(60000, proof.deadline - Date.now()))),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' } });
    const body = await boundedResponse(response);
    const currentBoot = response.headers.get('X-Acceptance-Boot');
    const capacity = Number(response.headers.get('X-Acceptance-Wasm-Capacity'));
    const actual = { index, status: response.status, inputBytes: input.length, inputSHA256: hash(input), responseBytes: body.length, responseSHA256: hash(body), bootID: currentBoot, wasmCapacityBytes: capacity, durationMs: performance.now() - start };
    if (response.status === 200) {
      [actual.width, actual.height] = row.route === 'thumbnail' ? webpDimensions(body) : [Number(response.headers.get('X-Image-Width')), Number(response.headers.get('X-Image-Height'))];
    }
    result.rows.push(actual);
    assert.match(currentBoot ?? '', /^[a-f0-9-]{36}$/, 'Missing boot identity');
    assert.ok(Number.isSafeInteger(capacity) && capacity > 0, 'Missing WASM capacity');
    boot ??= currentBoot;
    assert.equal(currentBoot, boot, 'Isolate changed; warm sequence invalid');
    assert.equal(actual.status, row.status, 'Unexpected status');
    assert.equal(actual.responseBytes, row.responseBytes, 'Unexpected output length');
    assert.equal(actual.responseSHA256, row.outputSHA256, 'Output differs from baseline');
    if (row.status === 200) {
      assert.equal(actual.width, row.width); assert.equal(actual.height, row.height);
      if (row.route === 'extract') assert.equal(body.length, actual.width * actual.height * 4, 'RGBA length');
    }
  }
  result.passed = true;
} catch {
  // No raw network response, error body, URL, token, or fixture path in receipts/logs.
  result.failure = 'Acceptance sequence failed; inspect numeric/hash receipts and local proxy status.';
  process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  fs.closeSync(lock);
  fs.unlinkSync(lockPath);
  console.log(JSON.stringify({ receipt: receiptPath, requestsCompleted: result.rows.length, passed: result.passed }));
}
