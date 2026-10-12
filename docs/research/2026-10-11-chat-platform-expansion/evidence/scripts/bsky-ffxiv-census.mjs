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
  // Official Square Enix FFXIV accounts. EN was confirmed by search; FR, DE and JP
  // (note: jp., not ja.) are three of the four accounts EN follows (2026-10-11).
  'en.finalfantasyxiv.com',
  'fr.finalfantasyxiv.com',
  'de.finalfantasyxiv.com',
  'jp.finalfantasyxiv.com',
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

// Search is fuzzy (searchActors splits ファイナルファンタジー14 and matches any "14"),
// so the search modes keep only results whose own text names FFXIV. NFKC folds
// fullwidth ＦＦ１４ to ff14. stream() keeps its own matching so its runs stay comparable.
const fold = (s) => (s ?? '').normalize('NFKC').toLowerCase();
const RELEVANCE_TERMS = [...new Set(STREAM_TERMS.map(fold))];
const isFfxiv = (...texts) => {
  const hay = fold(texts.join(' '));
  return RELEVANCE_TERMS.some((t) => hay.includes(t));
};
const RELEVANCE_NOTE = 'relevant = the result\'s own text (handle, name, description) contains an FFXIV term after NFKC folding. It misses FFXIV accounts that never say so, and keeps any that mention FFXIV once: it is not a test of FFXIV focus.';

// Pages through one search query until the cursor runs out or maxPages is reached.
async function searchAll(method, params, key, maxPages = 30) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page++) {
    const r = await xrpc(method, { ...params, limit: 100, cursor });
    items.push(...r[key]);
    cursor = r.cursor;
    if (!cursor || r[key].length === 0) return { items, pages: page + 1, capped: false };
  }
  return { items, pages: maxPages, capped: true };
}

async function actors() {
  const byDid = new Map();
  const perTerm = {};
  // Results stay ~99.7% relevant to the end ("ffxiv" ran 220 pages, 21,545 accounts, on
  // 2026-10-11), so page each term until its cursor runs out. Stop a term early once WINDOW
  // pages in a row add fewer than DRY_MIN new relevant accounts: the noisy term
  // (ファイナルファンタジー14 matches any "14") and the overlapping ones go dry first.
  const MAX_PAGES = 400, WINDOW = 20, DRY_MIN = 20;
  for (const q of SEARCH_TERMS) {
    let cursor, hits = 0, relevant = 0, pages = 0, stop = 'cap';
    const fresh = [];
    while (pages < MAX_PAGES) {
      const r = await xrpc('app.bsky.actor.searchActors', { q, limit: 100, cursor });
      pages++;
      let n = 0;
      for (const a of r.actors) {
        hits++;
        let prev = byDid.get(a.did);
        if (!prev) {
          prev = { handle: a.handle, displayName: a.displayName, relevant: isFfxiv(a.handle, a.displayName, a.description), matchedTerms: [] };
          byDid.set(a.did, prev);
          if (prev.relevant) n++;
        }
        if (!prev.matchedTerms.includes(q)) prev.matchedTerms.push(q);
        if (prev.relevant) relevant++;
      }
      fresh.push(n);
      cursor = r.cursor;
      if (!cursor || r.actors.length === 0) { stop = 'exhausted'; break; }
      if (fresh.length >= WINDOW && fresh.slice(-WINDOW).reduce((s, x) => s + x, 0) < DRY_MIN) { stop = 'dry'; break; }
    }
    const newRelevant = fresh.reduce((s, x) => s + x, 0);
    perTerm[q] = { hits, relevant, newRelevant, pages, stop };
    log(`actors "${q}": ${hits} hits, ${relevant} relevant, ${newRelevant} new relevant, ${pages} pages, stop=${stop}`);
  }
  const strip = ({ relevant, ...a }) => a;
  const all = [...byDid.entries()];
  const kept = all.filter(([, a]) => a.relevant);
  // searchActors returns profile views without follower counts; hydrate the relevant ones.
  for (let i = 0; i < kept.length; i += 25) {
    const { profiles: ps } = await xrpc('app.bsky.actor.getProfiles', { actors: kept.slice(i, i + 25).map(([did]) => did) });
    for (const p of ps) Object.assign(byDid.get(p.did), { followers: p.followersCount, posts: p.postsCount });
    if (i % 2500 === 0) log(`hydrated ${i + ps.length}/${kept.length}`);
  }
  const list = kept.map(([, a]) => strip(a)).sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  const dropped = all.filter(([, a]) => !a.relevant).map(([, a]) => strip(a));
  const bands = [['100k+', 1e5, Infinity], ['10k-100k', 1e4, 1e5], ['1k-10k', 1e3, 1e4], ['100-1k', 100, 1e3], ['<100', 0, 100]];
  const followerBuckets = Object.fromEntries(bands.map(([label, lo, hi]) => [label, list.filter((a) => (a.followers ?? 0) >= lo && (a.followers ?? 0) < hi).length]));
  return {
    asOf: new Date().toISOString(),
    note: `${RELEVANCE_NOTE} A term stops at its cursor's end ("exhausted"), after ${WINDOW} pages adding under ${DRY_MIN} new relevant accounts ("dry"), or at ${MAX_PAGES} pages ("cap", an undercount).`,
    searchMatched: all.length, relevant: list.length, perTerm, followerBuckets,
    droppedSample: dropped.slice(0, 25),
    top50: list.slice(0, 50),
  };
}

async function starterpacks() {
  const byUri = new Map();
  const perQuery = {};
  for (const q of ['ffxiv', 'ff14', 'final fantasy xiv', 'gpose', 'eorzea']) {
    const { items, pages, capped } = await searchAll('app.bsky.graph.searchStarterPacks', { q }, 'starterPacks');
    perQuery[q] = { hits: items.length, pages, capped };
    for (const sp of items) byUri.set(sp.uri, sp);
  }
  const all = [...byUri.values()];
  const relevant = (sp) => isFfxiv(sp.record?.name, sp.record?.description);
  // Search and getStarterPacks views carry no member count; getStarterPack has it on its list.
  const list = [];
  for (const sp of all.filter(relevant)) {
    const row = { name: sp.record?.name, creator: sp.creator?.handle, createdAt: sp.record?.createdAt, uri: sp.uri };
    try {
      const { starterPack: full } = await xrpc('app.bsky.graph.getStarterPack', { starterPack: sp.uri });
      Object.assign(row, { members: full.list?.listItemCount, joinedWeek: full.joinedWeekCount, joinedAllTime: full.joinedAllTimeCount });
    } catch (e) {
      row.error = e.message.slice(0, 120);
    }
    list.push(row);
  }
  list.sort((a, b) => (b.members ?? 0) - (a.members ?? 0));
  const sum = (k) => list.reduce((n, p) => n + (p[k] ?? 0), 0);
  return {
    asOf: new Date().toISOString(),
    note: `${RELEVANCE_NOTE} members sums overlap: one account can sit in many packs. joinedWeek/joinedAllTime appear to count accounts that signed up through the pack, not follows (inferred from the app's label).`,
    searchMatched: all.length, packs: list.length, perQuery,
    totalMembersListed: sum('members'), totalJoinedAllTime: sum('joinedAllTime'), totalJoinedWeek: sum('joinedWeek'),
    droppedNames: all.filter((sp) => !relevant(sp)).map((sp) => sp.record?.name),
    list,
  };
}

async function feeds() {
  const byUri = new Map();
  const perQuery = {};
  for (const query of ['ffxiv', 'ff14', 'gpose', 'eorzea', 'final fantasy']) {
    try {
      const { items, pages, capped } = await searchAll('app.bsky.unspecced.getPopularFeedGenerators', { query }, 'feeds');
      perQuery[query] = { hits: items.length, pages, capped };
      for (const f of items) byUri.set(f.uri, f);
    } catch (e) {
      perQuery[query] = { failed: e.message.slice(0, 120) };
      log(`getPopularFeedGenerators(${query}) failed: ${e.message}`);
    }
  }
  const view = (f) => ({ name: f.displayName, creator: f.creator?.handle, likes: f.likeCount, description: f.description?.slice(0, 140), uri: f.uri });
  const byLikes = (a, b) => (b.likes ?? 0) - (a.likes ?? 0);
  const all = [...byUri.values()];
  const kept = all.filter((f) => isFfxiv(f.displayName, f.description)).map(view).sort(byLikes);
  const dropped = all.filter((f) => !isFfxiv(f.displayName, f.description)).map(view).sort(byLikes);
  return {
    asOf: new Date().toISOString(), note: RELEVANCE_NOTE,
    searchMatched: all.length, relevant: kept.length, perQuery,
    likesRelevant: kept.reduce((n, f) => n + (f.likes ?? 0), 0),
    droppedTop25: dropped.slice(0, 25).map(({ name, creator, likes }) => ({ name, creator, likes })),
    feeds: kept,
  };
}

async function tags(days = 7) {
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until.getTime() - days * 86400000);
  const result = {};
  // Every post seen under any tag, keyed by URI: a post tagged #ffxiv #gpose counts
  // once in the union, and a URI repeated within one tag's pages is caught too.
  const union = new Map();
  const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
  for (const tag of TAGS) {
    let cursor, n = 0, repeats = 0, capped = false;
    const perDay = {}, byLang = {};
    for (let page = 0; page < 200; page++) {
      const r = await xrpc('app.bsky.feed.searchPosts', { q: `#${tag}`, since: since.toISOString(), until: until.toISOString(), limit: 100, sort: 'latest', cursor });
      for (const p of r.posts) {
        const d = (p.record?.createdAt ?? p.indexedAt).slice(0, 10);
        const lang = p.record?.langs?.[0] ?? '?';
        bump(perDay, d);
        bump(byLang, lang);
        n++;
        const u = union.get(p.uri) ?? { day: d, lang, tags: new Set() };
        if (u.tags.has(tag)) repeats++;
        u.tags.add(tag);
        union.set(p.uri, u);
      }
      cursor = r.cursor;
      if (!cursor || r.posts.length === 0) break;
      if (page === 199) capped = true;
    }
    result[tag] = { total: n, unique: n - repeats, perDay, avgPerDay: +(n / days).toFixed(1), byLang, capped };
    log(`#${tag}: ${n} posts over ${days} days${repeats ? ` (${repeats} repeated URIs)` : ''}${capped ? ' (page cap hit; undercount)' : ''}`);
  }
  const perDay = {}, byLang = {}, tagsPerPost = {};
  for (const u of union.values()) {
    bump(perDay, u.day);
    bump(byLang, u.lang);
    bump(tagsPerPost, u.tags.size);
  }
  const sumOfTagTotals = Object.values(result).reduce((s, t) => s + t.total, 0);
  log(`union: ${union.size} distinct posts across ${TAGS.length} tags (tag totals sum to ${sumOfTagTotals})`);
  return {
    since: since.toISOString(), until: until.toISOString(),
    note: 'searchPosts results; the search index may cap deep pagination, so treat large totals as lower bounds. Per-tag totals overlap; use union for distinct posts. byLang is the first declared language, "?" when none.',
    union: { total: union.size, perDay, avgPerDay: +(union.size / days).toFixed(1), byLang, tagsPerPost, sumOfTagTotals },
    tags: result,
  };
}

async function stream(minutes = 60) {
  const base = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
  let total = 0, matched = 0, firstUs = 0, lastUs = 0, reconnects = 0;
  const byLang = {}, byTerm = {}, samples = [];
  const started = Date.now();
  const deadline = started + minutes * 60000;
  const onEvent = (m) => {
    if (!m.time_us || m.time_us <= lastUs) return; // replayed after a reconnect
    lastUs = m.time_us;
    if (!firstUs) firstUs = m.time_us;
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
  const coveredMinutes = () => (lastUs - firstUs) / 6e7;
  // Results print only at the end, so checkpoint to stderr: a killed run still leaves its counts.
  const tick = setInterval(() => log(JSON.stringify({ checkpoint: new Date().toISOString(), coveredMinutes: +coveredMinutes().toFixed(1), reconnects, allPosts: total, ffxivPosts: matched, byLang, byTerm })), 5 * 60000);
  // Jetstream drops long-lived sockets (one closed after 15 minutes on 2026-10-12), so
  // reconnect from the last event's cursor: Jetstream replays from there, leaving no gap.
  while (Date.now() < deadline) {
    await new Promise((resolve) => {
      const ws = new WebSocket(lastUs ? `${base}&cursor=${lastUs}` : base);
      const stop = setTimeout(() => ws.close(), Math.max(deadline - Date.now(), 0));
      ws.onopen = () => log(lastUs ? `reconnected from cursor ${lastUs}` : `connected; sampling for ${minutes} min`);
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        onEvent(m);
      };
      ws.onerror = (e) => log(`jetstream: ${e.message ?? 'socket error'}`);
      ws.onclose = () => { clearTimeout(stop); resolve(); };
    });
    if (Date.now() < deadline) {
      reconnects++;
      log(`socket closed at ${new Date().toISOString()}; reconnecting`);
      await sleep(2000);
    }
  }
  clearInterval(tick);
  const hours = coveredMinutes() / 60;
  return {
    window: { start: new Date(started).toISOString(), minutes, coveredMinutes: +coveredMinutes().toFixed(1), reconnects },
    allPosts: total, ffxivPosts: matched,
    ffxivPerHour: hours ? +(matched / hours).toFixed(1) : 0, allPerHour: hours ? Math.round(total / hours) : 0,
    ffxivSharePct: total ? +((100 * matched) / total).toFixed(4) : 0,
    byLang, byTerm,
    note: 'Substring match; "gpose"/"eorzea" also catch non-FFXIV uses rarely, and trending-hashtag bots that list #ff14 are counted. Rates are per hour of event time covered (coveredMinutes), not wall time. Run at several times of day; one hour is not a daily rate.',
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
