// Local package.json versions vs the npm registry API (`npm view` serves stale data here).
// Run from the worktree root: node docs/audits/2026-09-19-i18n/evidence/scripts/versions-vs-registry.mjs
import { readFileSync } from 'node:fs';

const v = (p) => JSON.parse(readFileSync(`${p}/package.json`, 'utf8')).version;
for (const p of ['types', 'logger', 'auth', 'worker-kit', 'core', 'svg', 'bot-logic']) {
  let registry = 'ERR';
  try {
    const r = await fetch(`https://registry.npmjs.org/@xivdyetools%2F${p}/latest`);
    registry = (await r.json()).version;
  } catch (e) {
    registry = `ERR ${e.message}`;
  }
  console.log(`@xivdyetools/${p}  local=${v(`packages/${p}`)}  registry=${registry}`);
}
for (const a of ['web-app', 'discord-worker', 'api-worker', 'og-worker']) {
  console.log(`${a}  local=${v(`apps/${a}`)}`);
}
