// Mirrors validateExampleLink (apps/presets-api/src/services/validation-service.ts:390-420) +
// normalizeExampleLink (426-431) to show what is STORED for hostile-but-accepted input.
const HOSTS = ['eorzeacollection.com','mirapri.com','reddit.com','redd.it','x.com','twitter.com','bsky.app','instagram.com','pixiv.net','finalfantasyxiv.com','misskey.io'];
function validate(link){
  const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return null;
  return true;
}
for (const l of ['https://x.com/a\n[b](https://evil.example)', 'https://x.com/a\u202eevil', 'https://x.com/a b']) {
  console.log(JSON.stringify(l), 'accepted=', validate(l), 'stored raw=', JSON.stringify(l.trim()));
}
