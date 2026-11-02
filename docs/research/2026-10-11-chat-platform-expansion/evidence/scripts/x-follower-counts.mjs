#!/usr/bin/env node
// Aggregate-only X follower bands. Node 22+, no dependencies; no raw export.
// node x-follower-counts.mjs
// Optional EXTRA_PAIRS supplies comma-separated x:bsky input pairs in memory only.
// Public FxTwitter/vxTwitter relays provide secondary profile data.
import { count, followerBands, identity, requireInput, result, safeCli, sleep } from './aggregate-output.mjs';

const DEFAULT_ACCOUNTS = ['FF_XIV_EN', 'FF_XIV_FR', 'FF_XIV_DE', 'FF_XIV_JP', 'GPOSERS_FFXIV', 'FFXIVTeamcraft', 'gamerescape'];
function accounts() {
  requireInput(process.argv.length === 2);
  const pairs = process.env.EXTRA_PAIRS ? process.env.EXTRA_PAIRS.split(',').map((pair) => pair.trim().split(':')) : [];
  requireInput(pairs.length <= 1000 && pairs.every((pair) => pair.length === 2 && /^[A-Za-z0-9_]{1,15}$/.test(pair[0]) && /^(?=.{3,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/.test(pair[1])));
  return [...new Set([...DEFAULT_ACCOUNTS, ...pairs.map(([handle]) => handle)].map((handle) => handle.toLowerCase()))];
}
async function getJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'xivdyetools-research/2.0' } });
  if (!response.ok) return null;
  const body = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid response');
  return body;
}
function subject(user, fallback = false) {
  const handle = identity(user.screen_name);
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Invalid profile');
  const rawId = user.id_str ?? user.id;
  if (rawId !== undefined && !/^\d{1,32}$/.test(String(rawId))) throw new Error('Invalid profile');
  const id = rawId === undefined ? undefined : BigInt(rawId).toString();
  return { id, handle, followers: count(fallback ? user.followers_count : user.followers) };
}
async function lookup(handle) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await getJson(`https://api.fxtwitter.com/${handle}`);
    if (body?.user) return subject(body.user);
    if (attempt < 2) await sleep(3000 * (attempt + 1));
  }
  const body = await getJson(`https://api.vxtwitter.com/${handle}`);
  if (!body) throw new Error('Request failed');
  return subject(body, true);
}
await safeCli(async () => {
  const input = accounts();
  const subjects = new Set(), byId = new Map(), byHandle = new Map();
  for (const handle of input) {
    const found = await lookup(handle);
    const byStableId = found.id === undefined ? undefined : byId.get(found.id);
    const byCanonicalHandle = byHandle.get(found.handle);
    const merged = byStableId ?? byCanonicalHandle ?? {};
    // Join both identifiers: an alias can arrive with an ID on one relay and without it on another.
    if (byStableId && byCanonicalHandle && byStableId !== byCanonicalHandle) {
      subjects.delete(byCanonicalHandle);
      for (const [key, value] of byId) if (value === byCanonicalHandle) byId.set(key, merged);
      for (const [key, value] of byHandle) if (value === byCanonicalHandle) byHandle.set(key, merged);
    }
    merged.followers = found.followers;
    subjects.add(merged);
    if (found.id !== undefined) byId.set(found.id, merged);
    byHandle.set(found.handle, merged);
    await sleep(500);
  }
  return result('x', input.length, input.length, 0, followerBands(new Map([...subjects].map((item, index) => [index, item.followers]))));
});
