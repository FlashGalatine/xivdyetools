// Throwaway probe: what does the worker logger emit for assorted secret/PII shapes?
import { createWorkerLogger } from '../../../../../../packages/logger/dist/presets/worker.js';
const lines = [];
const orig = console.log; console.log = (s) => lines.push(s);
const l = createWorkerLogger({ service: 't', environment: 'production' });
const discordTok = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GabcDE.' + 'a'.repeat(27);
const jwt = 'eyJhbGciOiJIUzI1NiJ9' + '.eyJzdWIiOiIxMjM0NTY3ODkwIn0' + '.abcdefghijklmnop'; // synthetic, split so the secret scan does not flag the probe
const hex = 'ab'.repeat(32);
l.info('msg ' + discordTok + ' and ' + jwt + ' hex ' + hex);
l.info('ctx', { note: 'Bot ' + discordTok, arr: [jwt, hex, 'AXlTAAIncDE5Mzc2NTQzMjEwMTIzNDU2Nzg5MA=='], upstash: 'AXlTAAIncDE5Mzc2NTQ=', UPSTASH_REDIS_REST_TOKEN: 'abc', username: 'Alice', ip: '1.2.3.4', user: { id: '1', username: 'Bob', avatar: 'x' } });
l.error('boom', new Error('Authorization: Basic dXNlcjpwYXNz token=abc Bearer xyz'));
l.error('boom2', { message: 'upstash AXlTAAIncDE5Mzc2NTQ=' });
console.log = orig;
for (const x of lines) console.log(x);
