#!/usr/bin/env node
// FFXIV-on-Bluesky census. Node 22+, no dependencies.
//
//   node bsky-ffxiv-census.mjs profiles            # follower/post counts for the handles below
//   node bsky-ffxiv-census.mjs actors              # top accounts matching FFXIV search terms
//   node bsky-ffxiv-census.mjs starterpacks        # FFXIV starter packs with joined counts
//   node bsky-ffxiv-census.mjs feeds               # FFXIV feed generators with like counts
//   node bsky-ffxiv-census.mjs tags [days=7]       # posts per day per hashtag (searchPosts)
//   node bsky-ffxiv-census.mjs stream [minutes=60] # live Jetstream sample: FFXIV share of all posts
//
// searchPosts may refuse unauthenticated calls. If it does, set BSKY_HANDLE and
// BSKY_APP_PASSWORD (an app password, never the account password) and the script
// logs in to bsky.social and sends the same query through the PDS.
// Output is JSON on stdout; progress goes to stderr.

const PUBLIC = 'https://public.api.bsky.app/xrpc';
const PDS = 'https://bsky.social/xrpc';

const HANDLES = [
  // Official Square Enix FFXIV accounts. Only the EN handle was confirmed by search;
  // look up the FR / DE / JA handles from the EN account's profile or the Lodestone notice.
  'en.finalfantasyxiv.com',
  // Community organizations and creators named in the cloud research (verify each is FFXIV-focused).
  'gposers.org',
  'kaiyoko.bsky.social',
  'zepla.bsky.social',
  'ffxivteamcraft.com',
  'gamerescape.com',
];
const SEARCH_TERMS = ['ffxiv', 'ff14', 'final fantasy xiv', 'gpose', 'eorzea', 'ＦＦ14', 'ファイナルファンタジー14'];
const TAGS = ['ffxiv', 'ff14', 'gpose', 'gposers', 'ffxivsnaps', 'ffxivgpose', 'ffxivrp', 'ffxivart', 'eorzeaphotos', 'ffxivscreenshots'];
// Text matched by the stream sampler (lowercased substring match on post text and tags).
const STREAM_TERMS = ['ffxiv', 'ff14', 'ｆｆ14', 'final fantasy xiv', 'final fantasy 14', 'gpose', 'eorzea', 'エオルゼア', 'ファイナルファンタジー14', '파판14', '最终幻想14'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error(...a);

let session = null;
async function login() {
  if (session) return session;
  const { BSKY_HANDLE, BSKY_APP_PASSWORD } = process.env;
  if (!BSKY_HANDLE || !BSKY_APP_PASSWORD) return null;
  const res = await fetch(`${PDS}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: BSKY_HANDLE, password: BSKY_APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`createSession ${res.status}: ${await res.text()}`);
  session = await res.json();
  return session;
}

async function xrpc(method, params, { auth = false } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of [].concat(v)) qs.append(k, String(item));
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const s = auth ? await login() : null;
    const base = s ? PDS : PUBLIC;
    const headers = s ? { authorization: `Bearer ${s.accessJwt}` } : {};
    const res = await fetch(`${base}/${method}?${qs}`, { headers });
    if (res.status === 429) {
      const reset = Number(res.headers.get('ratelimit-reset')) * 1000 - Date.now();
      await sleep(Math.min(Math.max(reset, 2000), 60000));
      continue;
    }
    if ((res.status === 401 || res.status === 403) && !auth) return xrpc(method, params, { auth: true });
    if (!res.ok) throw new Error(`${method} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
  throw new Error(`${method}: still rate-limited after retries`);
}

async function profiles() {
  const out = [];
  for (let i = 0; i < HANDLES.length; i += 25) {
    const { profiles: ps } = await xrpc('app.bsky.actor.getProfiles', { actors: HANDLES.slice(i, i + 25) });
    for (const p of ps) out.push({ handle: p.handle, did: p.did, displayName: p.displayName, followers: p.followersCount, follows: p.followsCount, posts: p.postsCount, createdAt: p.createdAt });
  }
  const found = new Set(out.map((p) => p.handle));
  return { asOf: new Date().toISOString(), profiles: out, notFound: HANDLES.filter((h) => !found.has(h)) };
}

async function actors() {
  const byDid = new Map();
  for (const q of SEARCH_TERMS) {
    let cursor;
    for (let page = 0; page < 4; page++) {
      const r = await xrpc('app.bsky.actor.searchActors', { q, limit: 100, cursor });
      for (const a of r.actors) {
        const prev = byDid.get(a.did) ?? { handle: a.handle, displayName: a.displayName, matchedTerms: [] };
        prev.matchedTerms.push(q);
        byDid.set(a.did, prev);
      }
      cursor = r.cursor;
      if (!cursor) break;
    }
  }
  // searchActors returns basic views without follower counts; hydrate them.
  const dids = [...byDid.keys()];
  for (let i = 0; i < dids.length; i += 25) {
    const { profiles: ps } = await xrpc('app.bsky.actor.getProfiles', { actors: dids.slice(i, i + 25) });
    for (const p of ps) Object.assign(byDid.get(p.did), { followers: p.followersCount, posts: p.postsCount });
  }
  const list = [...byDid.values()].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  return { asOf: new Date().toISOString(), totalMatched: list.length, top50: list.slice(0, 50) };
}

async function starterpacks() {
  const byUri = new Map();
  for (const q of ['ffxiv', 'ff14', 'final fantasy xiv', 'gpose', 'eorzea']) {
    let cursor;
    for (let page = 0; page < 5; page++) {
      const r = await xrpc('app.bsky.graph.searchStarterPacks', { q, limit: 100, cursor });
      for (const sp of r.starterPacks) {
        byUri.set(sp.uri, {
          name: sp.record?.name, creator: sp.creator?.handle, members: sp.listItemCount,
          joinedWeek: sp.joinedWeekCount, joinedAllTime: sp.joinedAllTimeCount, createdAt: sp.record?.createdAt, uri: sp.uri,
        });
      }
      cursor = r.cursor;
      if (!cursor) break;
    }
  }
  const list = [...byUri.values()].sort((a, b) => (b.joinedAllTime ?? 0) - (a.joinedAllTime ?? 0));
  const sum = (k) => list.reduce((n, p) => n + (p[k] ?? 0), 0);
  return { asOf: new Date().toISOString(), packs: list.length, totalMembersListed: sum('members'), totalJoinedAllTime: sum('joinedAllTime'), totalJoinedWeek: sum('joinedWeek'), list };
}

async function feeds() {
  const byUri = new Map();
  for (const query of ['ffxiv', 'ff14', 'gpose', 'eorzea', 'final fantasy']) {
    let cursor;
    for (let page = 0; page < 3; page++) {
      let r;
      try {
        r = await xrpc('app.bsky.unspecced.getPopularFeedGenerators', { query, limit: 100, cursor });
      } catch (e) {
        log(`getPopularFeedGenerators(${query}) failed: ${e.message}`);
        break;
      }
      for (const f of r.feeds) byUri.set(f.uri, { name: f.displayName, creator: f.creator?.handle, likes: f.likeCount, description: f.description?.slice(0, 140), uri: f.uri });
      cursor = r.cursor;
      if (!cursor) break;
    }
  }
  return { asOf: new Date().toISOString(), feeds: [...byUri.values()].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)) };
}

async function tags(days = 7) {
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until.getTime() - days * 86400000);
  const result = {};
  for (const tag of TAGS) {
    let cursor, n = 0, capped = false;
    const perDay = {};
    for (let page = 0; page < 200; page++) {
      const r = await xrpc('app.bsky.feed.searchPosts', { q: `#${tag}`, since: since.toISOString(), until: until.toISOString(), limit: 100, sort: 'latest', cursor });
      for (const p of r.posts) {
        const d = (p.record?.createdAt ?? p.indexedAt).slice(0, 10);
        perDay[d] = (perDay[d] ?? 0) + 1;
        n++;
      }
      cursor = r.cursor;
      if (!cursor || r.posts.length === 0) break;
      if (page === 199) capped = true;
    }
    result[tag] = { total: n, perDay, avgPerDay: +(n / days).toFixed(1), capped };
    log(`#${tag}: ${n} posts over ${days} days${capped ? ' (page cap hit; undercount)' : ''}`);
  }
  return { since: since.toISOString(), until: until.toISOString(), note: 'searchPosts results; the search index may cap deep pagination, so treat large totals as lower bounds', tags: result };
}

async function stream(minutes = 60) {
  const url = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
  const ws = new WebSocket(url);
  let total = 0, matched = 0;
  const byLang = {}, byTerm = {}, samples = [];
  const started = Date.now();
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.kind !== 'commit' || m.commit?.operation !== 'create') return;
    total++;
    const rec = m.commit.record ?? {};
    const hay = `${rec.text ?? ''} ${(rec.tags ?? []).join(' ')} ${(rec.facets ?? []).flatMap((f) => f.features ?? []).map((x) => x.tag ?? '').join(' ')}`.toLowerCase();
    const hit = STREAM_TERMS.filter((t) => hay.includes(t));
    if (!hit.length) return;
    matched++;
    for (const t of hit) byTerm[t] = (byTerm[t] ?? 0) + 1;
    const lang = (rec.langs ?? ['?'])[0];
    byLang[lang] = (byLang[lang] ?? 0) + 1;
    if (samples.length < 20) samples.push((rec.text ?? '').slice(0, 100));
  };
  await new Promise((resolve, reject) => {
    ws.onerror = (e) => reject(new Error(`jetstream: ${e.message ?? 'socket error'}`));
    ws.onopen = () => log(`connected; sampling for ${minutes} min`);
    setTimeout(resolve, minutes * 60000);
  });
  ws.close();
  const hours = (Date.now() - started) / 3600000;
  return {
    window: { start: new Date(started).toISOString(), minutes },
    allPosts: total, ffxivPosts: matched,
    ffxivPerHour: +(matched / hours).toFixed(1), allPerHour: Math.round(total / hours),
    ffxivSharePct: total ? +((100 * matched) / total).toFixed(4) : 0,
    byLang, byTerm,
    note: 'Substring match; "gpose"/"eorzea" also catch non-FFXIV uses rarely. Run at several times of day; one hour is not a daily rate.',
    samples,
  };
}

const [cmd, arg] = process.argv.slice(2);
const run = { profiles, actors, starterpacks, feeds, tags: () => tags(Number(arg ?? 7)), stream: () => stream(Number(arg ?? 60)) }[cmd];
if (!run) {
  log('usage: node bsky-ffxiv-census.mjs <profiles|actors|starterpacks|feeds|tags [days]|stream [minutes]>');
  process.exit(2);
}
console.log(JSON.stringify(await run(), null, 2));
