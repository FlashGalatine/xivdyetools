// Synthetic network boundary for collectors.test.mjs; never contacts a service.
const scenario = process.env.COLLECTOR_CASE ?? 'success';
const secret = 'SYNTHETIC_PRIVATE_MARKER';
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, Math.min(ms, 2), ...args);
const singleton = scenario === 'singleton' || scenario === 'aliases';
const cohortSize = scenario === 'cohort4' ? 4 : scenario === 'cohort5' ? 5 : null;
const identity = (i) => `did:plc:synthetic${singleton ? 0 : cohortSize ? i % cohortSize : i}`;
const profile = (handle, i) => ({
  did: identity(i), handle, displayName: secret, description: `${secret} ffxiv user@example.invalid`,
  avatar: `https://example.invalid/${secret}`, followersCount: scenario === 'badnumber' ? -1 : scenario === 'sparse-band' && i === 0 ? 1000 : 10 + i,
  followsCount: 200 + i, postsCount: 1000 + i, createdAt: `2026-01-01T00:00:0${i}.000Z`,
});
const actors = Array.from({ length: singleton ? 1 : 7 }, (_, i) => profile(`synthetic${i}.example.invalid`, i));
function post(i, text = i < (scenario === 'singleton-match' ? 1 : 6) ? `ffxiv ${secret}` : `unrelated ${secret}`) {
  return {
    uri: `at://${identity(i)}/app.bsky.feed.post/${i}`, cid: `${secret}${i}`, author: profile(`synthetic${i}.example.invalid`, i),
    record: { $type: 'app.bsky.feed.post', text, createdAt: '2026-01-01T00:00:01.000Z', langs: [secret], tags: [secret], facets: [{ features: [{ uri: `https://example.invalid/${secret}`, tag: secret }] }] },
    indexedAt: '2026-01-01T00:00:01.000Z', likeCount: 44, replyCount: 23, repostCount: 13,
  };
}
const posts = Array.from({ length: singleton ? 1 : 12 }, (_, i) => post(i));
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init) => {
  const url = new URL(input);
  if (scenario === 'error') throw new Error(`${secret} ${url} credential=password`);
  if (scenario === 'remote-body') return new Response(`${secret} credential=password`, { status: 500 });
  if (scenario === 'malformed') return new Response(`{${secret}`, { status: 200 });
  if (scenario === 'auth-error') {
    if (url.pathname.endsWith('createSession')) return response({ message: secret }, 403);
    return response({ message: secret }, 401);
  }
  if (url.hostname === 'api.fxtwitter.com') {
    const index = ['FF_XIV_EN', 'FF_XIV_FR', 'FF_XIV_DE', 'FF_XIV_JP', 'GPOSERS_FFXIV', 'FFXIVTeamcraft', 'gamerescape'].findIndex((x) => url.pathname.toLowerCase() === `/${x.toLowerCase()}`);
    const canonical = singleton ? 0 : scenario === 'mixed-x-identities' ? index % 4 : cohortSize ? index % cohortSize : index;
    return response({ code: 200, user: { id: scenario === 'mixed-x-identities' && index >= 4 ? undefined : String(canonical), screen_name: `canonical_${canonical}`, name: secret, followers: scenario === 'badnumber' ? -1 : scenario === 'sparse-band' && index === 0 ? 1000 : 10 + index, following: 200, tweets: 400, joined: secret, description: secret } });
  }
  if (url.hostname === 'api.vxtwitter.com') return response({ message: secret }, 500);
  const method = url.pathname.split('/').pop();
  switch (method) {
    case 'app.bsky.actor.getProfiles': return response({ profiles: url.searchParams.getAll('actors').map((handle, i) => profile(handle, i)) });
    case 'app.bsky.actor.getProfile': return response(profile(url.searchParams.get('actor'), Math.max(0, ['en.finalfantasyxiv.com', 'fr.finalfantasyxiv.com', 'de.finalfantasyxiv.com', 'jp.finalfantasyxiv.com', 'gposers.org', 'ffxivteamcraft.com', 'gamerescape.com'].indexOf(url.searchParams.get('actor')))));
    case 'app.bsky.actor.searchActors': return response({ actors });
    case 'app.bsky.graph.searchStarterPacks': return response({ starterPacks: actors.map((a, i) => ({ uri: `at://${a.did}/app.bsky.graph.starterpack/${i}`, creator: a, record: { name: `ffxiv ${secret}`, description: secret, createdAt: secret } })) });
    case 'app.bsky.graph.getStarterPack': {
      const zero = scenario === 'zero-metric' || scenario === 'zero-padded' && !url.searchParams.get('starterPack').endsWith('/0');
      return response({ starterPack: { list: { listItemCount: scenario === 'badnumber' ? -1 : zero ? 0 : 10 }, joinedWeekCount: zero ? 0 : 2, joinedAllTimeCount: zero ? 0 : 20 } });
    }
    case 'app.bsky.unspecced.getPopularFeedGenerators': return response({ feeds: actors.map((a, i) => ({ uri: `at://${a.did}/app.bsky.feed.generator/${i}`, creator: a, displayName: `ffxiv ${secret}`, description: secret, likeCount: scenario === 'badnumber' ? -1 : scenario === 'zero-metric' || scenario === 'zero-padded' && i !== 0 ? 0 : 10 })) });
    case 'app.bsky.feed.getAuthorFeed': {
      const emoji = post(2, '😀');
      emoji.record.tags = [];
      emoji.record.facets = [];
      const firstSubject = url.searchParams.get('actor').endsWith('synthetic0');
      const first = scenario === 'focus-singleton-match' && !firstSubject ? post(0, 'unrelated text') : post(0);
      if (scenario === 'focus-singleton-classifiable' && !firstSubject) return response({ feed: [{ post: emoji }] });
      const second = scenario === 'focus-singleton-nonmatching' && !firstSubject ? post(1) : post(1, 'unrelated text');
      const third = scenario === 'focus-singleton-unclassified' && !firstSubject ? post(2) : emoji;
      return response({ feed: [{ post: first }, { post: second }, { post: third }] });
    }
    case 'app.bsky.feed.searchPosts': return response({ posts });
    default: throw new Error(`${secret} Unexpected request: ${url} ${Boolean(init)}`);
  }
};
globalThis.WebSocket = class {
  constructor() {
    if (scenario === 'socket-startup') throw new Error(`${secret} credential=password`);
    queueMicrotask(() => {
      this.onopen?.();
      if (['error', 'remote-body', 'auth-error'].includes(scenario)) this.onerror?.({ message: secret });
      if (scenario === 'malformed') this.onmessage?.({ data: `{${secret}` });
      const start = Date.parse('2026-01-01T00:00:00.000Z') * 1000;
      for (const [i, p] of posts.entries()) this.onmessage?.({ data: JSON.stringify({ time_us: start + (i + 1) * 1000000, did: scenario === 'singleton-nonmatch' && i >= 6 ? identity(6) : p.author.did, kind: 'commit', commit: { operation: 'create', collection: 'app.bsky.feed.post', rkey: String(i), record: p.record } }) });
      this.onmessage?.({ data: JSON.stringify({ time_us: start + 20000000, did: posts[0].author.did, kind: 'commit', commit: { operation: 'create', collection: 'app.bsky.feed.post', rkey: '0', record: posts[0].record } }) });
      this.onmessage?.({ data: JSON.stringify({ time_us: start + 60000000, kind: 'commit' }) });
    });
  }
  close() {
    if (scenario === 'socket-close') throw new Error(`${secret} credential=password`);
    queueMicrotask(() => this.onclose?.());
  }
};
