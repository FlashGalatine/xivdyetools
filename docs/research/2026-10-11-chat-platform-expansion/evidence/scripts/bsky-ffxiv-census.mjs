#!/usr/bin/env node
// Aggregate-only FFXIV census. Node 22+, no dependencies. No raw export mode.
// node bsky-ffxiv-census.mjs profiles|actors|starterpacks|feeds
// node bsky-ffxiv-census.mjs tags [days=7]
// node bsky-ffxiv-census.mjs focus [items=200]
// node bsky-ffxiv-census.mjs stream [minutes=60] [fromISO]
// Optional EXTRA_HANDLES is an in-memory comma-separated input; focus accepts no file input.
// BSKY_HANDLE / BSKY_APP_PASSWORD enable authenticated search when required.
import { MIN_SUBJECTS, array, count, followerBands, identity, requireInput, result, safeCli, share, sleep, text } from './aggregate-output.mjs';

const DEFAULT_HANDLES = ['en.finalfantasyxiv.com', 'fr.finalfantasyxiv.com', 'de.finalfantasyxiv.com', 'jp.finalfantasyxiv.com', 'gposers.org', 'ffxivteamcraft.com', 'gamerescape.com'];
const SEARCH_TERMS = ['ffxiv', 'ff14', 'final fantasy xiv', 'gpose', 'eorzea', 'ＦＦ14', 'ファイナルファンタジー14'];
const TAGS = ['ffxiv', 'ff14', 'gpose', 'gposers', 'ffxivsnaps', 'ffxivgpose', 'ffxivrp', 'ffxivart', 'eorzeaphotos', 'ffxivscreenshots'];
const STREAM_TERMS = ['ffxiv', 'ff14', 'ｆｆ14', 'final fantasy xiv', 'final fantasy 14', 'gpose', 'eorzea', 'エオルゼア', 'ファイナルファンタジー14', '파판14', '最终幻想14'];
const fold = (value) => text(value).normalize('NFKC').toLowerCase();
const relevant = (...values) => STREAM_TERMS.some((term) => fold(values.map(text).join(' ')).includes(fold(term)));
const FOCUS_SUBSTRINGS = [...STREAM_TERMS, 'finalfantasyxiv', 'a realm reborn', 'heavensward', 'stormblood', 'shadowbringers', 'endwalker', 'dawntrail', 'warrior of light', 'fashion report', 'pictomancer', 'lalafell', 'miqote', "miqo'te", 'miqo’te', 'hroth', 'roegadyn', 'elezen', 'ララフェル', 'ミコッテ', '黄金のレガシー', '暁月', '光の戦士', 'グルポ'].map(fold);
const FOCUS_WORDS = ['xiv', 'msq', 'au ra', 'hyur', 'viera'].map((word) => new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'u'));
const focused = (value) => FOCUS_SUBSTRINGS.some((term) => fold(value).includes(term)) || FOCUS_WORDS.some((re) => re.test(fold(value)));

function options() {
  const [mode, arg, from, ...rest] = process.argv.slice(2);
  requireInput(['profiles', 'actors', 'starterpacks', 'feeds', 'focus', 'tags', 'stream'].includes(mode) && rest.length === 0);
  const defaults = { focus: 200, tags: 7, stream: 60 };
  let amount;
  if (Object.hasOwn(defaults, mode)) {
    requireInput(arg === undefined || /^\d+$/.test(arg));
    amount = Number(arg ?? defaults[mode]);
    requireInput(Number.isSafeInteger(amount) && amount >= 1 && amount <= ({ focus: 10000, tags: 365, stream: 1440 })[mode]);
  } else requireInput(arg === undefined);
  requireInput(from === undefined || mode === 'stream');
  if (from !== undefined) {
    requireInput(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(from));
    requireInput(Number.isFinite(Date.parse(from)) && new Date(from).toISOString() === from);
  }
  const extras = process.env.EXTRA_HANDLES ? process.env.EXTRA_HANDLES.split(',').map((handle) => handle.trim()) : [];
  requireInput(extras.length <= 1000 && extras.every((handle) => /^(?=.{3,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/.test(handle)));
  requireInput(Boolean(process.env.BSKY_HANDLE) === Boolean(process.env.BSKY_APP_PASSWORD));
  return { mode, amount, from, handles: [...new Set([...DEFAULT_HANDLES, ...extras].map((h) => h.toLowerCase()))] };
}

function client() {
  let session;
  async function login() {
    if (session) return session;
    if (!process.env.BSKY_HANDLE) return null;
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: process.env.BSKY_HANDLE, password: process.env.BSKY_APP_PASSWORD }),
    });
    if (!response.ok) throw new Error('Authentication failed');
    const body = await response.json();
    if (typeof body?.accessJwt !== 'string' || !body.accessJwt) throw new Error('Invalid session');
    session = body;
    return session;
  }
  return async function xrpc(method, params, auth = false) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined) for (const item of [].concat(value)) qs.append(key, String(item));
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = auth ? await login() : null;
      const response = await fetch(`${current ? 'https://bsky.social/xrpc' : 'https://public.api.bsky.app/xrpc'}/${method}?${qs}`, { headers: current ? { authorization: `Bearer ${current.accessJwt}` } : {} });
      if (response.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      if ([401, 403].includes(response.status) && !auth && process.env.BSKY_HANDLE) return xrpc(method, params, true);
      if (!response.ok) throw new Error('Request failed');
      const body = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid response');
      return body;
    }
    throw new Error('Request failed');
  };
}

async function searchAll(xrpc, method, params, key, maxPages = 30) {
  const items = [];
  let cursor;
  for (let page = 0; page < maxPages; page++) {
    const response = await xrpc(method, { ...params, limit: 100, cursor });
    const batch = array(response[key]);
    items.push(...batch);
    cursor = response.cursor;
    if (cursor !== undefined && typeof cursor !== 'string') throw new Error('Invalid cursor');
    if (!cursor || !batch.length) break;
  }
  return items;
}

async function profiles(xrpc, handles) {
  const subjects = new Map();
  let succeeded = 0;
  for (let i = 0; i < handles.length; i += 25) {
    const response = await xrpc('app.bsky.actor.getProfiles', { actors: handles.slice(i, i + 25) });
    const batch = array(response.profiles);
    for (const profile of batch) subjects.set(identity(profile.did), count(profile.followersCount));
    succeeded += batch.length;
  }
  return result('profiles', handles.length, succeeded, Math.max(0, handles.length - succeeded), followerBands(subjects));
}

async function actors(xrpc) {
  const subjects = new Map();
  for (const q of SEARCH_TERMS) {
    let cursor;
    const fresh = [];
    for (let page = 0; page < 400; page++) {
      const response = await xrpc('app.bsky.actor.searchActors', { q, limit: 100, cursor });
      const batch = array(response.actors);
      let added = 0;
      for (const actor of batch) {
        const did = identity(actor.did);
        if (!subjects.has(did) && relevant(actor.handle, actor.displayName, actor.description)) { subjects.set(did, null); added++; }
      }
      fresh.push(added);
      cursor = response.cursor;
      if (cursor !== undefined && typeof cursor !== 'string') throw new Error('Invalid cursor');
      if (!cursor || !batch.length || (fresh.length >= 20 && fresh.slice(-20).reduce((a, b) => a + b, 0) < 20)) break;
    }
  }
  const hydrated = new Map();
  const dids = [...subjects.keys()];
  for (let i = 0; i < dids.length; i += 25) {
    const response = await xrpc('app.bsky.actor.getProfiles', { actors: dids.slice(i, i + 25) });
    for (const profile of array(response.profiles)) {
      const did = identity(profile.did);
      if (subjects.has(did)) hydrated.set(did, count(profile.followersCount));
    }
  }
  return result('actors', dids.length, hydrated.size, dids.length - hydrated.size, followerBands(hydrated));
}

async function catalog(xrpc, mode) {
  const packs = mode === 'starterpacks';
  const byUri = new Map();
  for (const query of ['ffxiv', 'ff14', 'gpose', 'eorzea', 'final fantasy']) {
    const items = await searchAll(xrpc, packs ? 'app.bsky.graph.searchStarterPacks' : 'app.bsky.unspecced.getPopularFeedGenerators', packs ? { q: query } : { query }, packs ? 'starterPacks' : 'feeds');
    for (const item of items) byUri.set(identity(item.uri), item);
  }
  const creators = new Set();
  const metrics = packs ? { packs: 0, membersListed: 0, joinedWeek: 0, joinedAllTime: 0 } : { feeds: 0, likes: 0 };
  const contributors = Object.fromEntries((packs ? ['membersListed', 'joinedWeek', 'joinedAllTime'] : ['likes']).map((key) => [key, new Set()]));
  const add = (key, value, creator) => {
    count(value);
    metrics[key] = count(metrics[key] + value);
    if (value > 0) contributors[key].add(creator);
  };
  let succeeded = 0;
  for (const item of byUri.values()) {
    if (!relevant(packs ? item.record?.name : item.displayName, packs ? item.record?.description : item.description)) continue;
    const creator = identity(item.creator?.did);
    creators.add(creator);
    if (packs) {
      const response = await xrpc('app.bsky.graph.getStarterPack', { starterPack: item.uri });
      const full = response.starterPack;
      metrics.packs++;
      add('membersListed', full.list?.listItemCount, creator);
      add('joinedWeek', full.joinedWeekCount, creator);
      add('joinedAllTime', full.joinedAllTimeCount, creator);
    } else {
      metrics.feeds++;
      add('likes', item.likeCount, creator);
    }
    succeeded++;
  }
  const safe = creators.size >= MIN_SUBJECTS && Object.entries(contributors).every(([key, subjects]) => metrics[key] === 0 || subjects.size >= MIN_SUBJECTS);
  return result(mode, byUri.size, succeeded, 0, safe ? metrics : null);
}

function postText(post) {
  const record = post.record ?? {};
  const parts = [record.text, ...array(record.tags ?? [])];
  const addEmbed = (embed, depth = 0) => {
    if (!embed) return;
    if (depth > 4) throw new Error('Invalid embed');
    for (const image of array(embed.images ?? [])) parts.push(image.alt);
    parts.push(embed.alt, embed.external?.title, embed.external?.description, embed.external?.uri);
    addEmbed(embed.media, depth + 1);
  };
  addEmbed(record.embed);
  parts.push(post.embed?.record?.value?.text, post.embed?.record?.record?.value?.text);
  return parts.map(text).join(' ');
}

async function focus(xrpc, handles, maxItems) {
  const subjects = new Set(), classifiableSubjects = new Set(), matchingSubjects = new Set(), nonmatchingSubjects = new Set(), unclassifiedSubjects = new Set();
  const metrics = { sampledPosts: 0, classifiablePosts: 0, ffxivPosts: 0, ffxivSharePct: 0 };
  for (const handle of handles) {
    const profile = await xrpc('app.bsky.actor.getProfile', { actor: handle });
    const did = identity(profile.did);
    if (subjects.has(did)) continue;
    let cursor, sampled = 0;
    // The queried subject's originals, replies and reposts form one pooled feed sample.
    do {
      const response = await xrpc('app.bsky.feed.getAuthorFeed', { actor: did, filter: 'posts_with_replies', limit: Math.min(100, maxItems - sampled), cursor });
      const batch = array(response.feed);
      for (const item of batch.slice(0, maxItems - sampled)) {
        const body = postText(item.post);
        sampled++;
        metrics.sampledPosts++;
        if (focused(body)) {
          matchingSubjects.add(did); classifiableSubjects.add(did);
          metrics.ffxivPosts++; metrics.classifiablePosts++;
        } else if ((body.match(/\p{L}/gu) ?? []).length >= 3) {
          nonmatchingSubjects.add(did); classifiableSubjects.add(did);
          metrics.classifiablePosts++;
        } else unclassifiedSubjects.add(did);
      }
      cursor = response.cursor;
      if (cursor !== undefined && typeof cursor !== 'string') throw new Error('Invalid cursor');
      if (!batch.length) break;
    } while (cursor && sampled < maxItems);
    if (sampled) subjects.add(did);
  }
  metrics.ffxivSharePct = share(metrics.ffxivPosts, metrics.classifiablePosts);
  // Counts can be subtracted: classifiable - matching, and sampled - classifiable.
  // Every occupied complement must therefore meet the same contributor minimum.
  const safe = subjects.size >= MIN_SUBJECTS && classifiableSubjects.size >= MIN_SUBJECTS && matchingSubjects.size >= MIN_SUBJECTS
    && [nonmatchingSubjects, unclassifiedSubjects].every((set) => set.size === 0 || set.size >= MIN_SUBJECTS);
  return result('focus', handles.length, subjects.size, 0, safe ? metrics : null);
}

async function tags(xrpc, days) {
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until.getTime() - days * 86400000);
  const subjects = new Set(), union = new Set();
  let observations = 0;
  for (const tag of TAGS) {
    const posts = await searchAll(xrpc, 'app.bsky.feed.searchPosts', { q: `#${tag}`, since: since.toISOString(), until: until.toISOString(), sort: 'latest' }, 'posts', 200);
    for (const post of posts) {
      subjects.add(identity(post.author?.did));
      union.add(identity(post.uri));
      observations++;
    }
  }
  const metrics = { posts: union.size, observations, duplicatesSkipped: observations - union.size, averagePerDay: Math.round((10 * union.size) / days) / 10 };
  // Every result belongs to the matching hashtag cohort; its distinct authors gate all metrics.
  return result('tags', TAGS.length, TAGS.length, 0, subjects.size >= MIN_SUBJECTS ? metrics : null);
}

async function stream(minutes, from) {
  const base = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
  const fromUs = from ? Date.parse(from) * 1000 : 0;
  const endUs = from ? fromUs + minutes * 60000000 : 0;
  const deadline = Date.now() + minutes * 60000 + (from ? 3600000 : 0);
  const seen = new Set(), authors = new Set(), matchingAuthors = new Set(), nonmatchingAuthors = new Set();
  let posts = 0, ffxivPosts = 0, duplicatesSkipped = 0, lastUs = fromUs, done = false, connections = 0;
  while (!done && Date.now() < deadline) {
    connections++;
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base}${lastUs ? `&cursor=${lastUs}` : ''}`);
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        let failed = error;
        try { ws.close(); } catch { failed = true; }
        if (failed) reject(new Error('Stream failed')); else resolve();
      };
      const timer = setTimeout(() => { done = true; finish(); }, Math.max(deadline - Date.now(), 0));
      ws.onerror = () => finish(true);
      ws.onclose = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
      ws.onmessage = (event) => {
        if (settled) return;
        try {
          const message = JSON.parse(event.data);
          const at = count(message.time_us);
          if (at < fromUs || at <= lastUs) return;
          if (endUs && at >= endUs) { done = true; finish(); return; }
          lastUs = at;
          if (message.kind !== 'commit' || message.commit?.operation !== 'create') return;
          if (message.commit.collection !== 'app.bsky.feed.post') return;
          const did = identity(message.did);
          const key = `${did}/${identity(message.commit.rkey)}`;
          if (seen.has(key)) { duplicatesSkipped++; return; }
          seen.add(key);
          authors.add(did);
          posts++;
          const record = message.commit.record ?? {};
          const body = [record.text, ...array(record.tags ?? []), ...array(record.facets ?? []).flatMap((facet) => array(facet.features ?? []).map((feature) => feature.tag))].map(text).join(' ').toLowerCase();
          if (STREAM_TERMS.some((term) => body.includes(term))) { matchingAuthors.add(did); ffxivPosts++; }
          else nonmatchingAuthors.add(did);
        } catch { finish(true); }
      };
    });
    if (!done && Date.now() < deadline) await sleep(2000);
  }
  const metrics = { posts, ffxivPosts, duplicatesSkipped, ffxivSharePct: share(ffxivPosts, posts) };
  const safe = authors.size >= MIN_SUBJECTS && matchingAuthors.size >= MIN_SUBJECTS && (nonmatchingAuthors.size === 0 || nonmatchingAuthors.size >= MIN_SUBJECTS);
  return result('stream', connections, connections, 0, safe ? metrics : null);
}

await safeCli(async () => {
  const { mode, amount, from, handles } = options();
  const xrpc = client();
  if (mode === 'profiles') return profiles(xrpc, handles);
  if (mode === 'actors') return actors(xrpc);
  if (mode === 'starterpacks' || mode === 'feeds') return catalog(xrpc, mode);
  if (mode === 'focus') return focus(xrpc, handles, amount);
  if (mode === 'tags') return tags(xrpc, amount);
  return stream(amount, from);
});
