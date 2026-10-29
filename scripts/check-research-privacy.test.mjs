import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const research = path.join(root, 'docs/research/2026-10-11-chat-platform-expansion');
const evidence = path.join(research, 'evidence/bluesky-census');
const publicationNote =
  'Historical aggregate-only publication. Account, profile, creator and post records are not retained. Contributor thresholds introduced for later collection cannot be verified from these retained aggregates.';
const searches = [
  'ffxiv',
  'ff14',
  'final fantasy xiv',
  'gpose',
  'eorzea',
  'ＦＦ14',
  'ファイナルファンタジー14',
  'final fantasy',
];
const tags = [
  'ffxiv',
  'ff14',
  'gpose',
  'gposers',
  'ffxivsnaps',
  'ffxivgpose',
  'ffxivrp',
  'ffxivart',
  'eorzeaphotos',
  'ffxivscreenshots',
];
const terms = [
  'ffxiv',
  'ff14',
  'ｆｆ14',
  'final fantasy xiv',
  'final fantasy 14',
  'gpose',
  'eorzea',
  'エオルゼア',
  'ファイナルファンタジー14',
  '파판14',
  '最终幻想14',
];
const languages = [
  'en',
  'ja',
  '?',
  'pt',
  'es',
  'fi',
  'it',
  'ko',
  'fr',
  'nl',
  'de',
  'zh',
  'ru',
  'th',
  'id',
  'ar',
  'uk',
  'tr',
  'pl',
  'sv',
  'da',
  'cs',
  'vi',
  'hu',
  'no',
  'el',
  'he',
  'ro',
  'sk',
  'ca',
  'tl',
  'bg',
  'nb',
  'ber',
  'en-US',
  'et',
  'other',
];
const shapes = {
  profiles: ['asOf', 'profileCount', 'publicationNote'],
  tags: ['since', 'until', 'tags', 'union', 'publicationNote'],
  feeds: ['asOf', 'searchMatched', 'relevant', 'perQuery', 'likesRelevant', 'publicationNote'],
  starterpacks: [
    'asOf',
    'searchMatched',
    'packs',
    'perQuery',
    'totalMembersListed',
    'totalJoinedAllTime',
    'totalJoinedWeek',
    'droppedNames',
    'publicationNote',
  ],
  actors: ['asOf', 'searchMatched', 'relevant', 'perTerm', 'followerBuckets', 'publicationNote'],
  focus: ['asOf', 'maxItems', 'accountCount', 'publicationNote'],
  verdicts: ['asOf', 'tally', 'accountCount', 'publicationNote'],
  x: ['asOf', 'accountCount', 'publicationNote'],
  stream: [
    'window',
    'allPosts',
    'duplicatesSkipped',
    'ffxivPosts',
    'ffxivPerHour',
    'allPerHour',
    'ffxivSharePct',
    'byLang',
    'byTerm',
    'publicationNote',
  ],
};
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const labels = /\b(?:creator-\d+|top50-\d+|acct-\d+)\b/;
const personalMeasurements =
  /\b(?:creator|parody|fan-run|personal)\b[^\n]{0,180}\b\d[\d,.]*(?:\s*[kKmM])?\s+(?:followers|viewers)\b/i;
const namedFeedExamples =
  /(?:community:|Other FFXIV feeds|Custom feeds|Japanese feed)[^\n]*["“][^"”]+["”]/i;

function assertPublicNarrative(value) {
  assert.ok(!labels.test(value), 'stable individual label');
  assert.ok(!personalMeasurements.test(value), 'individual activity measurement');
  assert.ok(!namedFeedExamples.test(value), 'creator-owned named feed example');
}

function object(value, allowed, at, visit) {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `object required at ${at}`,
  );
  for (const [key, item] of Object.entries(value)) {
    assert.ok(allowed.includes(key), `unapproved field at ${at}`);
    visit(key, item, `${at}.${key}`);
  }
}

function numeric(value, at) {
  assert.ok(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    `aggregate number required at ${at}`,
  );
}

function field(key, value, at) {
  if (['asOf', 'since', 'until', 'start'].includes(key)) {
    assert.ok(
      typeof value === 'string' && iso.test(value) && Number.isFinite(Date.parse(value)),
      `run timestamp required at ${at}`,
    );
  } else if (key === 'publicationNote') {
    assert.equal(value, publicationNote, 'unapproved publication note');
  } else if (key === 'stop') {
    assert.ok(['exhausted', 'dry', 'cap'].includes(value), 'unapproved stop value');
  } else if (key === 'mode') {
    assert.ok(['live', 'replay'].includes(value), 'unapproved stream mode');
  } else if (key === 'capped') {
    assert.equal(typeof value, 'boolean');
  } else if (key === 'window') {
    object(value, ['mode', 'start', 'minutes', 'coveredMinutes', 'reconnects'], at, field);
  } else if (key === 'perTerm' || key === 'perQuery') {
    object(value, searches, at, (_query, row, location) =>
      object(row, ['hits', 'relevant', 'newRelevant', 'pages', 'stop', 'capped'], location, field),
    );
  } else if (key === 'tags') {
    object(value, tags, at, (_tag, row, location) =>
      object(row, ['total', 'unique', 'perDay', 'avgPerDay', 'byLang', 'capped'], location, field),
    );
  } else if (key === 'union') {
    object(
      value,
      ['total', 'perDay', 'avgPerDay', 'byLang', 'tagsPerPost', 'sumOfTagTotals'],
      at,
      field,
    );
  } else if (key === 'perDay') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    for (const [day, count] of Object.entries(value)) {
      assert.match(day, /^\d{4}-\d{2}-\d{2}$/, 'unapproved date bucket');
      numeric(count, at);
    }
  } else if (['byLang', 'byTerm', 'tagsPerPost', 'followerBuckets', 'tally'].includes(key)) {
    const keys = {
      byLang: languages,
      byTerm: terms,
      tagsPerPost: Array.from({ length: 10 }, (_, i) => String(i + 1)),
      followerBuckets: ['under100', '100to999', '1000plus'],
      tally: ['focused', 'mostly', 'partly', 'not'],
    }[key];
    object(value, keys, at, (_bucket, count, location) => numeric(count, location));
    if (key === 'followerBuckets') {
      for (const count of Object.values(value))
        assert.ok(count === 0 || count >= 5, 'sparse audience table');
    }
  } else {
    numeric(value, at);
  }
}

function validate(kind, value) {
  object(value, shapes[kind], kind, field);
  assert.equal(value.publicationNote, publicationNote);
}

function kindFor(name) {
  if (name.includes('tags-7d')) return 'tags';
  if (name.includes('focus-top50-verdicts')) return 'verdicts';
  if (name.includes('focus')) return 'focus';
  if (name.includes('x-followers')) return 'x';
  if (name.includes('stream-')) return 'stream';
  for (const kind of ['profiles', 'feeds', 'starterpacks', 'actors'])
    if (name.endsWith(`-${kind}.json`)) return kind;
  throw new Error('Unreviewed evidence filename');
}

test('publication schema rejects individual rows, unknown nested keys and free text', () => {
  const safe = { asOf: '2026-10-29T00:00:00.000Z', profileCount: 9, publicationNote };
  validate('profiles', safe);
  assert.throws(() =>
    validate('profiles', { ...safe, profiles: [{ handle: 'synthetic.invalid' }] }),
  );
  assert.throws(() => validate('profiles', { ...safe, profileCount: 'synthetic.invalid' }));
  assert.throws(() =>
    validate('profiles', { ...safe, publicationNote: 'unreviewed profile text' }),
  );
  assert.throws(() =>
    validate('actors', { asOf: safe.asOf, followerBuckets: { under100: 1 }, publicationNote }),
  );
  assert.throws(() => validate('stream', { byLang: { 'synthetic.invalid': 10 }, publicationNote }));
  assert.throws(() => validate('feeds', { perQuery: { ffxiv: { handles: [] } }, publicationNote }));
});

test('published research JSON contains only approved aggregate fields', () => {
  const files = readdirSync(evidence).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0);
  for (const name of files)
    validate(kindFor(name), JSON.parse(readFileSync(path.join(evidence, name), 'utf8')));
});

test('narrative boundary rejects individual measurements and named creator-owned examples', () => {
  assertPublicNarrative('Whole-category audience: 12345 viewers.');
  assert.throws(() =>
    assertPublicNarrative('A private creator drew 12345 viewers at a watch party.'),
  );
  assert.throws(() => assertPublicNarrative('A parody account has 12345 followers.'));
  assert.throws(() =>
    assertPublicNarrative('Bluesky community: "Synthetic personal feed" with account details.'),
  );
});

test('public research has no stable individual labels or hand-count files', () => {
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      assert.ok(!labels.test(entry.name), 'individual label in filename');
      if (entry.isDirectory()) {
        if (entry.name !== 'scripts') walk(full);
        continue;
      }
      assert.ok(!entry.name.endsWith('.tsv'), 'person-linked hand-count artifact');
      if (/\.(?:md|json|js|log)$/.test(entry.name))
        assert.ok(
          !labels.test(readFileSync(full, 'utf8')),
          `individual label retained in ${path.relative(research, full)}`,
        );
      if (entry.name.endsWith('.md')) assertPublicNarrative(readFileSync(full, 'utf8'));
    }
  }
  walk(research);
});
