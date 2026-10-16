#!/usr/bin/env node
// X follower counts for the census accounts. Node 22+, no dependencies.
//
//   node x-follower-counts.mjs > out.json
//
// X's own API is paid, and Social Blade refuses scripted requests (HTTP 403 on
// 2026-10-12), so this reads FxTwitter's public API (api.fxtwitter.com), which
// relays X's profile data. That makes the counts `secondary`: spot-check a few
// against the X profiles by hand.

const ACCOUNTS = [
  // [X handle, Bluesky handle it is paired with]
  ['FF_XIV_EN', 'en.finalfantasyxiv.com'],
  ['FF_XIV_FR', 'fr.finalfantasyxiv.com'],
  ['FF_XIV_DE', 'de.finalfantasyxiv.com'],
  ['FF_XIV_JP', 'jp.finalfantasyxiv.com'],
  ['GPOSERS_FFXIV', 'gposers.org'],
  ['FFXIVTeamcraft', 'ffxivteamcraft.com'],
  ['gamerescape', 'gamerescape.com'],
  // The community accounts measured in the census are passed at run time via EXTRA_PAIRS (comma-separated
  // x:bsky pairs) and not named here (redacted 2026-10-16; see the census README's Redaction section).
  ...(process.env.EXTRA_PAIRS ? process.env.EXTRA_PAIRS.split(',').map((p) => p.trim().split(':')).filter((p) => p.length === 2) : []),
];

const getJson = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'xivdyetools-research/1.0' } });
  return { ok: res.ok, status: res.status, j: await res.json().catch(() => ({})) };
};
// FxTwitter intermittently answers "404 User not found" for accounts that exist
// (FF_XIV_EN did on 2026-10-13, minutes after answering), so retry it with a pause,
// then fall back to vxTwitter (api.vxtwitter.com), which relays the same data.
async function lookup(x) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { ok, j } = await getJson(`https://api.fxtwitter.com/${x}`);
    if (ok && j.user) {
      const u = j.user;
      return { x: u.screen_name, name: u.name, followers: u.followers, following: u.following, posts: u.tweets, joined: u.joined, description: u.description, source: `https://api.fxtwitter.com/${x}` };
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  const { ok, status, j } = await getJson(`https://api.vxtwitter.com/${x}`);
  if (!ok || j.followers_count == null) throw new Error(`both relays failed (vxTwitter ${status})`);
  return { x: j.screen_name, name: j.name, followers: j.followers_count, following: j.following_count, posts: j.tweet_count, joined: j.created_at, description: j.description, source: `https://api.vxtwitter.com/${x}` };
}

const out = [];
for (const [x, bsky] of ACCOUNTS) {
  try {
    const u = await lookup(x);
    // Bios can carry contact addresses the research has no use for.
    out.push({ ...u, bsky, description: u.description?.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email redacted]') });
  } catch (e) {
    out.push({ x, bsky, error: String(e.message ?? e) });
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.log(JSON.stringify({ asOf: new Date().toISOString(), source: 'api.fxtwitter.com, falling back to api.vxtwitter.com (both relay X profile data; secondary)', accounts: out }, null, 2));
