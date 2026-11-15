import { readFileSync, writeFileSync } from 'node:fs';
import { LocaleLoader, CONSOLIDATED_DYES, MATCHING_METHOD_TAGS } from '../../../../../packages/core/dist/index.js';
import { OG_DECK, TOOL_TAG, OG_DECK_LINE, OG_ROLE } from '../../../../../apps/og-worker/src/services/og-strings.ts';
const locales = ['en','ja','de','fr','ko','zh'] as const;
function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings);
  return [];
}
const inputs: Record<string,Record<string,string[]>> = {'og-worker':{},'discord-worker':{}};
for (const lang of locales) {
  const {meta,locale,...rest} = new LocaleLoader().loadLocale(lang) as any;
  const core = strings(rest);
  inputs['og-worker'][lang] = [...core,...strings(OG_DECK[lang]),...strings(TOOL_TAG[lang]),...strings(OG_DECK_LINE[lang]),...strings(OG_ROLE[lang])];
  const {meta: botMeta,...bot} = JSON.parse(readFileSync(`packages/bot-logic/src/i18n/locales/${lang}.json`,'utf8'));
  for (const cmd of Object.values(bot.commands ?? {}) as any[]) delete cmd.options;
  const itemNames = ['ja','ko','zh'].includes(lang) ? strings(JSON.parse(readFileSync(`apps/api-worker/src/chara/data/item-names.${lang}.json`,'utf8'))) : [];
  inputs['discord-worker'][lang] = [...core,...strings(bot),...Object.values(CONSOLIDATED_DYES).map((v:any)=>v.names[lang]??''),...strings(MATCHING_METHOD_TAGS),...itemNames];
}
writeFileSync('docs/audits/2026-10-26-i18n/evidence/font-input-codepoints.json', JSON.stringify(Object.fromEntries(Object.entries(inputs).map(([unit,byLang])=>[unit,Object.fromEntries(Object.entries(byLang).map(([lang,ss])=>[lang,[...new Set(ss.join('').split('').length ? Array.from(ss.join('')).map(s=>s.codePointAt(0)!).filter(cp=>cp>32&&cp!==0xfe0f) : [])].sort((a,b)=>a-b)]))])),null,2)+'\n');
