#!/usr/bin/env node
// American-English spelling sweep — candidate generator for documentation-audit
// and i18n-manager.
//
//   node american-spelling.mjs <xivdyetools-dir> [path…] [--all] [--list] [--fix] [--keys=a,b]
//
// With no paths it sweeps the default English surfaces: the living docs tier
// (docs/ minus audits/, historical/, research/, superpowers/ — the archive and
// frozen-body tiers are never rewritten), the four English policy documents,
// and the /manual strings in bot-logic's en.json. Pass explicit paths for a
// narrowed run (READMEs, CLAUDE.md files, one locale file, one folder).
//
// A path is read by its extension: markdown as prose, a locale .json as string
// VALUES reported at their key's line (all keys, or those under --keys=a,b),
// a .ts/.js string table as quoted literals. A string table laid out as
// per-locale `en: {` / `fr: {` blocks is read inside its `en` block alone, so
// a French `centre` is never mistaken for a British spelling. Named explicitly,
// bot-logic's en.json is read whole; only the default sweep narrows it to
// /manual, which is the part documentation-audit owns.
//
// Rules and carve-outs live in ../american-english.md. Read it before filing
// anything: this script reports CANDIDATES, not findings. The glossary wins —
// `docs/reference/ffxiv-terminology.md` and `glossary.md` decide every game
// term, and a candidate that contradicts them is rejected, not corrected.
//
// Zones. Each hit is tagged by where it sits on the line: `prose` (body text,
// headings, table cells), `diagram` (a mermaid/graph fence — rendered labels,
// so prose), `code` (an inline span or a code fence), `link` (a URL, a link
// target, an HTML tag), `ui-text` (a locale value or string-table literal). Only prose,
// diagram and ui-text are reported by default; --all adds code and link,
// which is how you check whether an identifier itself is British.
//
// Notes column: `glossary?` = the word is also a single-word game term (the
// Facewear colour Grey, a dye name), so check the dictionary before touching
// it; `multilingual-row?` = the table row carries CJK/Hangul, so the hit may
// be a French/German cell rather than English prose.
//
// Known limits, all under-reporting except where noted:
//   - The dictionary is an explicit list (--list prints it). A British word
//     that is not on it is not reported; read for spellings too, and add the
//     word here when one turns up.
//   - Multi-word protected names ("Ash Grey") are suppressed by matching the
//     phrase in core's dye/facewear data, so a new Grey dye is protected the
//     day it lands. A single-word name cannot be told from ordinary prose, so
//     it is reported with `glossary?` rather than dropped.
//   - An unbalanced backtick on a line makes the rest of that line read as a
//     code span (under-reports, bounded to the line). An odd ``` fence does
//     the same to the rest of the file.
//   - `analyses` and `practice`/`practise` are ambiguous between the noun and
//     the verb, so only the unambiguous forms are listed.
//   - `towards`, `forwards`, `dialogue` (a conversation), `glamour` (the game
//     system) and `programme` in a proper name are acceptable and not listed.
//   - A directory argument is expanded to its tracked scannable files; a path
//     that is neither readable nor a directory is fatal rather than skipped,
//     so a swept-but-unread target can never read as clean (Codex P2, PR #196).
// Exit 1 when any reportable candidate is found, 0 when clean, 2 on a usage
// error or an unreadable/missing path.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const LIST = argv.includes('--list');
const FIX = argv.includes('--fix');
const KEYS =
  argv
    .find((a) => a.startsWith('--keys='))
    ?.slice(7)
    .split(',')
    .filter(Boolean) ?? null;
const [repo, ...paths] = argv.filter((a) => !a.startsWith('--'));
if (!repo && !LIST) {
  console.error(
    'usage: node american-spelling.mjs <xivdyetools-dir> [path…] [--all] [--list] [--fix] [--keys=a,b]',
  );
  process.exit(2);
}

// ---------------------------------------------------------------- dictionary
const dict = new Map(); // british (lower-case) -> american
const add = (br, am) => {
  if (br.toLowerCase() !== am.toLowerCase()) dict.set(br.toLowerCase(), am.toLowerCase());
};
const expand = (stems, suffixes, toAmerican) => {
  for (const stem of stems) for (const suf of suffixes) add(stem + suf, toAmerican(stem) + suf);
};

// -our → -or. `glamour` is the FFXIV system and is deliberately absent.
expand(
  [
    'ardour',
    'armour',
    'behaviour',
    'candour',
    'clamour',
    'colour',
    'demeanour',
    'endeavour',
    'favour',
    'fervour',
    'flavour',
    'harbour',
    'honour',
    'humour',
    'labour',
    'neighbour',
    'odour',
    'parlour',
    'rigour',
    'rumour',
    'saviour',
    'savour',
    'splendour',
    'succour',
    'tumour',
    'valour',
    'vapour',
    'vigour',
  ],
  [
    '',
    's',
    'ed',
    'ing',
    'er',
    'ers',
    'al',
    'ally',
    'able',
    'ably',
    'ful',
    'fully',
    'fulness',
    'less',
    'lessly',
    'ist',
    'ists',
    'ite',
    'ites',
    'hood',
    'hoods',
    'blind',
    'blindness',
    'ous',
    'ously',
    'ation',
    'ations',
  ],
  (s) => s.replace(/our$/, 'or'),
);
// -ise/-isation → -ize/-ization. Stems carry no trailing `e`, so `organis` +
// `ation` covers organisation. The look-alikes that are -ise in both
// (advise, comprise, exercise, supervise, surprise, …) are simply not listed.
expand(
  [
    'amortis',
    'apologis',
    'authoris',
    'canonis',
    'categoris',
    'centralis',
    'characteris',
    'colouris',
    'computeris',
    'criticis',
    'customis',
    'decentralis',
    'digitis',
    'dramatis',
    'economis',
    'emphasis',
    'energis',
    'equalis',
    'familiaris',
    'finalis',
    'formalis',
    'generalis',
    'globalis',
    'harmonis',
    'humanis',
    'idealis',
    'immunis',
    'initialis',
    'itemis',
    'jeopardis',
    'legalis',
    'localis',
    'marginalis',
    'materialis',
    'maximis',
    'mechanis',
    'memoris',
    'minimis',
    'mobilis',
    'modernis',
    'modularis',
    'monopolis',
    'moralis',
    'nationalis',
    'neutralis',
    'normalis',
    'optimis',
    'organis',
    'ostracis',
    'oxidis',
    'parameteris',
    'patronis',
    'penalis',
    'personalis',
    'polaris',
    'popularis',
    'pressuris',
    'prioritis',
    'privatis',
    'publicis',
    'randomis',
    'rationalis',
    'realis',
    'recognis',
    'regularis',
    'revitalis',
    'sanitis',
    'scrutinis',
    'serialis',
    'socialis',
    'specialis',
    'stabilis',
    'standardis',
    'sterilis',
    'stigmatis',
    'subsidis',
    'summaris',
    'symbolis',
    'sympathis',
    'synchronis',
    'synthesis',
    'systematis',
    'tantalis',
    'terroris',
    'theoris',
    'trivialis',
    'urbanis',
    'utilis',
    'vaporis',
    'verbalis',
    'victimis',
    'visualis',
  ],
  ['e', 'es', 'ed', 'ing', 'er', 'ers', 'able', 'ation', 'ations'],
  (s) => s.replace(/is$/, 'iz'),
);
// -yse → -yze. `es` is left out: the noun plural `analyses` is American too.
expand(
  ['analys', 'catalys', 'dialys', 'electrolys', 'hydrolys', 'paralys'],
  ['e', 'ed', 'ing', 'er', 'ers', 'able'],
  (s) => s.replace(/ys$/, 'yz'),
);
// -re → -er. Stems are the British word minus its final `e`, so `centr` + `ed`
// is `centred` on the British side and `center` + `ed` on the American one —
// expanding `centre` itself would produce `centerd`.
for (const stem of [
  'calibr',
  'centimetr',
  'centr',
  'fibr',
  'goitr',
  'kilometr',
  'litr',
  'louvr',
  'lustr',
  'meagr',
  'metr',
  'millimetr',
  'mitr',
  'nanometr',
  'nitr',
  'ochr',
  'reconnoitr',
  'saltpetr',
  'sceptr',
  'sepulchr',
  'sombr',
  'spectr',
  'theatr',
  'titr',
]) {
  const am = stem.replace(/r$/, 'er');
  for (const [br, suf] of [
    ['e', ''],
    ['es', 's'],
    ['ed', 'ed'],
    ['ing', 'ing'],
  ])
    add(stem + br, am + suf);
}
// -ce → -se (nouns), and the verb `practise`
expand(['defence', 'licence', 'offence', 'pretence'], ['', 's', 'd', 'less', 'lessly'], (s) =>
  s.replace(/ce$/, 'se'),
);
for (const [br, am] of [
  ['practise', 'practice'],
  ['practises', 'practices'],
  ['practised', 'practiced'],
  ['practising', 'practicing'],
])
  add(br, am);
// Doubled consonant where American English keeps one
for (const [br, am] of [
  ['cancelled', 'canceled'],
  ['cancelling', 'canceling'],
  ['counselled', 'counseled'],
  ['counselling', 'counseling'],
  ['counsellor', 'counselor'],
  ['counsellors', 'counselors'],
  ['dialled', 'dialed'],
  ['dialling', 'dialing'],
  ['equalled', 'equaled'],
  ['equalling', 'equaling'],
  ['fuelled', 'fueled'],
  ['fuelling', 'fueling'],
  ['jeweller', 'jeweler'],
  ['jewellers', 'jewelers'],
  ['jewellery', 'jewelry'],
  ['labelled', 'labeled'],
  ['labelling', 'labeling'],
  ['levelled', 'leveled'],
  ['levelling', 'leveling'],
  ['marvellous', 'marvelous'],
  ['modelled', 'modeled'],
  ['modelling', 'modeling'],
  ['quarrelled', 'quarreled'],
  ['signalled', 'signaled'],
  ['signalling', 'signaling'],
  ['totalled', 'totaled'],
  ['totalling', 'totaling'],
  ['travelled', 'traveled'],
  ['traveller', 'traveler'],
  ['travellers', 'travelers'],
  ['travelling', 'traveling'],
  // …and where it takes two
  ['appal', 'appall'],
  ['distil', 'distill'],
  ['enrol', 'enroll'],
  ['enrolment', 'enrollment'],
  ['enthral', 'enthrall'],
  ['fulfil', 'fulfill'],
  ['fulfils', 'fulfills'],
  ['fulfilment', 'fulfillment'],
  ['instalment', 'installment'],
  ['instil', 'instill'],
  ['skilful', 'skillful'],
  ['wilful', 'willful'],
])
  add(br, am);
// -logue → -log. `dialogue` (a conversation) is American too; only the UI
// element is `dialog`, so it is left to the reviewer and not listed.
for (const stem of ['analog', 'catalog']) {
  for (const [br, suf] of [
    ['ue', ''],
    ['ues', 's'],
    ['ued', 'ed'],
    ['uing', 'ing'],
  ])
    add(stem + br, stem + suf);
}
// Singles
for (const [br, am] of [
  ['aeroplane', 'airplane'],
  ['ageing', 'aging'],
  ['aluminium', 'aluminum'],
  ['amongst', 'among'],
  ['artefact', 'artifact'],
  ['artefacts', 'artifacts'],
  ['cheque', 'check'],
  ['cheques', 'checks'],
  ['cosy', 'cozy'],
  ['draught', 'draft'],
  ['draughts', 'drafts'],
  ['dreamt', 'dreamed'],
  ['encyclopaedia', 'encyclopedia'],
  ['foetus', 'fetus'],
  ['gaol', 'jail'],
  ['grey', 'gray'],
  ['greyed', 'grayed'],
  ['greying', 'graying'],
  ['greyish', 'grayish'],
  ['greys', 'grays'],
  ['greyscale', 'grayscale'],
  ['judgement', 'judgment'],
  ['judgements', 'judgments'],
  ['kerb', 'curb'],
  ['learnt', 'learned'],
  ['manoeuvre', 'maneuver'],
  ['manoeuvres', 'maneuvers'],
  ['manoeuvred', 'maneuvered'],
  ['manoeuvring', 'maneuvering'],
  ['maths', 'math'],
  ['mould', 'mold'],
  ['moulded', 'molded'],
  ['moulding', 'molding'],
  ['moulds', 'molds'],
  ['moult', 'molt'],
  ['orientated', 'oriented'],
  ['paediatric', 'pediatric'],
  ['plough', 'plow'],
  ['programme', 'program'],
  ['programmes', 'programs'],
  ['pyjamas', 'pajamas'],
  ['sceptic', 'skeptic'],
  ['sceptical', 'skeptical'],
  ['scepticism', 'skepticism'],
  ['smoulder', 'smolder'],
  ['smouldering', 'smoldering'],
  ['speciality', 'specialty'],
  ['specialities', 'specialties'],
  ['spelt', 'spelled'],
  ['storey', 'story'],
  ['storeys', 'stories'],
  ['sulphate', 'sulfate'],
  ['sulphur', 'sulfur'],
  ['tyre', 'tire'],
  ['tyres', 'tires'],
  ['whilst', 'while'],
])
  add(br, am);

if (LIST) {
  console.log(`# american-spelling dictionary — ${dict.size} entries\n`);
  for (const k of [...dict.keys()].sort()) console.log(`${k} → ${dict.get(k)}`);
  process.exit(0);
}

const WORDS = [...dict.keys()].sort((a, b) => b.length - a.length);
const PATTERN = `\\b(${WORDS.join('|')})\\b`;
const RE = new RegExp(PATTERN, 'gi');
const HAS = new RegExp(PATTERN, 'i'); // non-global: `g` + .test() is stateful

// --------------------------------------------------- protected game terms
// Multi-word names from core's own data are suppressed outright; a one-word
// name can be ordinary prose, so it is flagged `glossary?` instead.
const readRepo = (p) => readFileSync(join(repo, p), 'utf8');
const names = [];
for (const p of [
  'packages/core/src/data/dyes.json',
  'packages/core/src/data/facewear_colors.json',
]) {
  try {
    for (const e of JSON.parse(readRepo(p))) if (e?.name) names.push(String(e.name));
  } catch {
    console.error(`! could not read ${p} — game-term protection is off for this run`);
  }
}
const phrases = names.filter((n) => n.includes(' ') && HAS.test(n));
const soloTerms = new Set(names.filter((n) => !n.includes(' ')).map((n) => n.toLowerCase()));

// -------------------------------------------------------------- file sweep
const ls = (...pats) =>
  execFileSync('git', ['-C', repo, 'ls-files', '--', ...pats], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

const MANUAL_EN = 'packages/bot-logic/src/i18n/locales/en.json';
const ARCHIVE = /^docs\/(audits|historical|research|superpowers)\//;
const ENGLISH_POLICY = /^apps\/[^/]+\/(PRIVACY|PRIVACY_POLICY|TERMS_OF_SERVICE)\.md$/;
const SCANNABLE = /\.(md|json|ts|tsx|js|mjs)$/;

/**
 * A directory argument becomes its tracked, scannable files. Without this
 * `readFileSync` throws EISDIR, the per-file catch swallows it, and the run
 * reports zero candidates and exits 0 — a falsely clean audit over a whole
 * subtree. A path that is neither a readable file nor a directory is fatal
 * for the same reason: silence must never read as success.
 */
const expandPath = (p) => {
  let st;
  try {
    st = statSync(join(repo, p));
  } catch {
    console.error(`! no such path: ${p}`);
    process.exit(2);
  }
  if (!st.isDirectory()) return [p];
  let found;
  try {
    found = ls(p).filter((f) => SCANNABLE.test(f));
  } catch {
    console.error(`! cannot list ${p}/ — is ${repo} a git checkout?`);
    process.exit(2);
  }
  if (found.length === 0) console.error(`! ${p}/ holds no tracked scannable file`);
  return found;
};

const targets = paths.length
  ? [...new Set(paths.flatMap(expandPath))]
  : [
      ...ls('docs').filter((f) => f.endsWith('.md') && !ARCHIVE.test(f)),
      ...ls('apps/*/PRIVACY*.md', 'apps/*/TERMS_OF_SERVICE*.md').filter((f) =>
        ENGLISH_POLICY.test(f),
      ),
      MANUAL_EN,
    ];

const FENCE = /^\s*(?:```|~~~)(.*)$/;
const DIAGRAM = /^(mermaid|graph|flowchart|sequencediagram|gantt|classdiagram)/i;
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/** Per-character zone map for one markdown line. */
const zonesFor = (line) => {
  const z = new Array(line.length).fill('prose');
  const mark = (m, kind) => {
    for (let i = m.index; i < m.index + m[0].length && i < z.length; i++) z[i] = kind;
  };
  for (const m of line.matchAll(/`+[^`]*`+/g)) mark(m, 'code');
  for (const m of line.matchAll(/\]\([^)]*\)/g)) mark(m, 'link');
  for (const m of line.matchAll(/(?:https?:\/\/|www\.)[^\s)<>\]]+/g)) mark(m, 'link');
  for (const m of line.matchAll(/<[^>\s]+>/g)) mark(m, 'link');
  return z;
};

const hits = [];
// `path` is the source file on disk and `col` the 0-based column in its raw
// line; --fix needs both, and `file` may carry a `:key` suffix for display.
const push = (file, line, zone, found, note, path, col) =>
  hits.push({ file, line, zone, found, want: dict.get(found.toLowerCase()), note, path, col });

const suppressed = (line, m) =>
  phrases.some((p) => {
    const at = line.toLowerCase().indexOf(p.toLowerCase());
    return at >= 0 && m.index >= at && m.index < at + p.length;
  });

const scanMarkdown = (file, text) => {
  let fence = null;
  text.split('\n').forEach((line, i) => {
    const f = line.match(FENCE);
    if (f) {
      fence = fence === null ? (DIAGRAM.test(f[1].trim()) ? 'diagram' : 'code') : null;
      return;
    }
    const zones = fence === null ? zonesFor(line) : null;
    const multilingual = line.startsWith('|') && CJK.test(line);
    for (const m of line.matchAll(RE)) {
      if (suppressed(line, m)) continue;
      const zone = fence ?? zones[m.index];
      const note = [
        soloTerms.has(m[0].toLowerCase()) ? 'glossary?' : '',
        multilingual ? 'multilingual-row?' : '',
      ]
        .filter(Boolean)
        .join(' ');
      push(file, i + 1, zone, m[0], note, file, m.index);
    }
  });
};

/** `at` is the column where `value` starts inside its raw line. */
const scanValue = (file, key, line, value, at) => {
  for (const m of value.matchAll(RE)) {
    if (suppressed(value, m)) continue;
    push(
      `${file}:${key}`,
      line,
      'ui-text',
      m[0],
      soloTerms.has(m[0].toLowerCase()) ? 'glossary?' : '',
      file,
      at + m.index,
    );
  }
};

/**
 * Locale JSON: string VALUES only, reported at the line of the key that holds
 * them. `prefixes` narrows to one surface (the default sweep reads only
 * /manual out of bot-logic's en.json); null reads every key.
 */
const scanLocaleJson = (file, text, prefixes) => {
  const stack = [];
  text.split('\n').forEach((line, i) => {
    const open = line.match(/^(\s*)"([^"]+)":\s*\{/);
    if (open) {
      stack.length = open[1].length / 2 - 1;
      stack.push(open[2]);
      return;
    }
    const pair = line.match(/^(\s*)"([^"]+)":\s*"(.*)"\s*,?\s*$/);
    if (!pair) return;
    const path = [...stack.slice(0, pair[1].length / 2 - 1), pair[2]].join('.');
    if (prefixes && !prefixes.some((p) => path === p || path.startsWith(`${p}.`))) return;
    scanValue(file, path, i + 1, pair[3], line.lastIndexOf(`"${pair[3]}"`) + 1);
  });
};

/**
 * TypeScript string tables (og-strings.ts, og-embed.ts): quoted literals only.
 * A file laid out as per-locale `en: {` / `fr: {` blocks is read inside its
 * `en` block alone, so a French `centre` never reads as a British spelling;
 * a file with no such block is read whole.
 */
const scanTsStrings = (file, text) => {
  const lines = text.split('\n');
  const blocked = lines.some((l) => /^\s{0,4}en:\s*\{/.test(l));
  let inEn = !blocked;
  lines.forEach((line, i) => {
    const loc = line.match(/^\s{0,4}([a-z]{2}):\s*\{/);
    if (blocked && loc) inEn = loc[1] === 'en';
    if (!inEn || /^\s*(import|export type|\/\/)/.test(line)) return;
    for (const lit of line.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`\\]*)`/g)) {
      scanValue(
        file,
        (line.match(/^\s*([\w.]+)\s*:/) ?? [, '?'])[1],
        i + 1,
        lit[1] ?? lit[2] ?? lit[3],
        lit.index + 1,
      );
    }
  });
};

const MANUAL_KEYS = ['manual', 'manual5', 'matchImageHelp'];
// This script is a dictionary of British words by construction, so it would
// otherwise report ~136 candidates against itself — the same self-reference
// trap scripts/check-dead-code.ts documents about its own files.
const SELF = 'american-spelling.mjs';
for (const file of targets.filter((f) => !f.endsWith(SELF))) {
  let text;
  try {
    text = readRepo(file);
  } catch (err) {
    // Fatal, not skipped: a swept-but-unread file would count as clean.
    console.error(`! unreadable: ${file} — ${err.code ?? err.message}`);
    process.exit(2);
  }
  if (file.endsWith('.json')) {
    // The default sweep takes only /manual out of en.json; an explicitly named
    // file is read whole unless --keys narrows it.
    scanLocaleJson(
      file,
      text,
      KEYS ?? (paths.length === 0 && file === MANUAL_EN ? MANUAL_KEYS : null),
    );
  } else if (/\.(ts|tsx|js|mjs)$/.test(file)) scanTsStrings(file, text);
  else scanMarkdown(file, text);
}

// ----------------------------------------------------------------- report
const REPORTED = new Set(
  ALL ? ['prose', 'diagram', 'ui-text', 'code', 'link'] : ['prose', 'diagram', 'ui-text'],
);
const shown = hits.filter((h) => REPORTED.has(h.zone));
const hidden = hits.length - shown.length;

// --------------------------------------------------------------------- fix
// Rewrites in place, at the exact columns the scan found, so an identifier in
// a code span or a link target is never touched. Anything a human must settle
// is left alone: a `glossary?` hit (the dictionary decides, and it wins) and a
// `multilingual-row?` hit (the cell may not be English). Run it on a batch you
// have already triaged — it applies candidates, it does not confirm them.
if (FIX) {
  const held = shown.filter((h) => h.note);
  const byFile = new Map();
  for (const h of shown) {
    if (h.note) continue;
    if (!byFile.has(h.path)) byFile.set(h.path, []);
    byFile.get(h.path).push(h);
  }
  let applied = 0;
  for (const [path, list] of byFile) {
    const lines = readRepo(path).split('\n');
    // Descending by line then column: every edit lands before the offsets of
    // the ones still queued for that line.
    for (const h of list.sort((a, b) => b.line - a.line || b.col - a.col)) {
      const line = lines[h.line - 1];
      if (line.slice(h.col, h.col + h.found.length) !== h.found) {
        console.error(`! ${path}:${h.line}:${h.col} moved since the scan — left alone`);
        continue;
      }
      lines[h.line - 1] =
        line.slice(0, h.col) + matchCase(h.found, h.want) + line.slice(h.col + h.found.length);
      applied++;
    }
    writeFileSync(join(repo, path), lines.join('\n'));
  }
  console.log(`Rewrote ${applied} spelling(s) in ${byFile.size} file(s).`);
  if (held.length) {
    console.log(
      `Left for review (${held.length}) — the glossary or a non-English cell decides these:`,
    );
    for (const h of held) console.log(`  ${h.file}:${h.line} ${h.found} — ${h.note}`);
  }
  process.exit(0);
}

console.log('| location | zone | found | suggested | note |');
console.log('|---|---|---|---|---|');
for (const h of shown) {
  console.log(
    `| ${h.file}:${h.line} | ${h.zone} | ${h.found} | ${matchCase(h.found, h.want)} | ${h.note || '—'} |`,
  );
}

const byWord = new Map();
for (const h of shown)
  byWord.set(h.found.toLowerCase(), (byWord.get(h.found.toLowerCase()) ?? 0) + 1);
const top = [...byWord.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([w, n]) => `${w}→${dict.get(w)} ${n}`)
  .join(' · ');

console.log(
  `\nFiles swept: ${targets.length} · candidates: ${shown.length} in ${new Set(shown.map((h) => h.file)).size} files`,
);
console.log(
  `Suppressed zones (code/link, --all shows them): ${hidden} · dictionary: ${dict.size} entries`,
);
if (top) console.log(`Most frequent: ${top}`);
console.log(
  'Candidates, not findings — confirm each against ../american-english.md before filing.',
);
process.exit(shown.length > 0 ? 1 : 0);

function matchCase(found, want) {
  if (found === found.toUpperCase()) return want.toUpperCase();
  if (found[0] === found[0].toUpperCase()) return want[0].toUpperCase() + want.slice(1);
  return want;
}
