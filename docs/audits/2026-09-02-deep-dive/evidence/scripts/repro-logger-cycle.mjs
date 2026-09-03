// Repro for pkg-foundation-01: does a secret reachable through a cycle survive redaction?
import {
  BaseLogger,
  JsonAdapter,
} from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/logger/dist/index.js';

const entries = [];
class Probe extends BaseLogger {
  write(entry) {
    entries.push(entry);
  }
  formatMessage(m) {
    return m;
  }
}
const logger = new Probe({ level: 'debug' });

const ctx = { token: 'shhh-super-secret', inner: {} };
ctx.inner.back = ctx;
logger.info('cycle test', ctx);

// Walk the REDACTED entry graph and look for the raw secret.
const SECRET = 'shhh-super-secret';
function findSecret(node, path, seen) {
  if (node === SECRET) return path;
  if (node === null || typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);
  for (const [k, v] of Object.entries(node)) {
    const hit = findSecret(v, `${path}.${k}`, seen);
    if (hit) return hit;
  }
  return null;
}
const where = findSecret(entries[0], 'entry', new Set());

console.log('--- verdict ---');
console.log('raw secret reachable in redacted entry at :', where ?? 'NOT FOUND');
console.log('top-level token value                     :', entries[0].context.token);

// And what the shipped JSON adapter actually emits:
const out = [];
const adapter = new JsonAdapter({ write: (s) => out.push(s) });
try {
  adapter.write(entries[0]);
} catch (e) {
  out.push('THREW: ' + e.message);
}
const emitted = out.join('\n');
console.log('JsonAdapter emits raw secret              :', emitted.includes(SECRET));
console.log('emitted (first 400):', emitted.slice(0, 400));
