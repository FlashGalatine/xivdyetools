// Local preparation only. No Wrangler process, upload, deployment, or network request.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const argument = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
assert.ok(argument('source-root') && argument('output-dir') && argument('account-id'), 'Required: --source-root=<checkout> --output-dir=<new ignored folder> --account-id=<32 lowercase hex digits>');
const accountId = argument('account-id');
assert.match(accountId, /^[a-f0-9]{32}$/, 'Invalid --account-id: expected 32 lowercase hex digits');
const root = fs.realpathSync(argument('source-root'));
const output = path.resolve(root, argument('output-dir'));
const relative = path.relative(root, output);
assert.ok(relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'Output must be inside source checkout');
assert.equal(cp.spawnSync('git', ['check-ignore', '--quiet', '--', relative], { cwd: root }).status, 0, 'Output must be git-ignored');
assert.ok(!fs.existsSync(output), 'Preserve sessions: output directory must not exist');
const parent = fs.realpathSync(path.dirname(output));
assert.equal(parent, path.dirname(output), 'Output parent must exist without symlink indirection');
const here = path.dirname(fileURLToPath(import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const wasmPath = path.join(root, 'apps/image-worker/vendor/photon/photon-owned.wasm');
const productConfig = fs.readFileSync(path.join(root, 'apps/image-worker/wrangler.toml'), 'utf8');
assert.match(productConfig, /main\s*=\s*"src\/worker.ts"/);
assert.match(productConfig, /compatibility_date\s*=\s*"2024-12-01"/);
assert.match(productConfig, /compatibility_flags\s*=\s*\["enable_request_signal"\]/);
const store = path.join(root, 'node_modules/.pnpm');
const matches = fs.readdirSync(store).filter(name => name === 'esbuild@0.28.2' || name.startsWith('esbuild@0.28.2_'));
assert.equal(matches.length, 1, 'Expected installed pinned esbuild');
const esbuild = createRequire(import.meta.url)(path.join(store, matches[0], 'node_modules/esbuild'));
const templatePath = path.join(here, 'canary-entry.mjs.template');
const deadline = Date.now() + 15 * 60 * 1000;
const entry = fs.readFileSync(templatePath, 'utf8')
  .replace('__PRODUCT_ENTRY__', JSON.stringify(slash(path.join(root, 'apps/image-worker/src/worker.ts'))))
  .replace('__NOT_AFTER__', String(deadline));
const wasmResolutions = [];
const built = await esbuild.build({
  absWorkingDir: root,
  stdin: { contents: entry, resolveDir: path.join(root, 'apps/image-worker'), sourcefile: 'canary-entry.mjs' },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'],
  write: false, metafile: true,
  plugins: [{ name: 'retain-product-wasm', setup(build) {
    build.onResolve({ filter: /\.wasm$/ }, args => {
      wasmResolutions.push(path.resolve(args.resolveDir, args.path));
      return { path: './photon.wasm', external: true };
    });
  } }],
});
assert.deepEqual(wasmResolutions, [wasmPath], 'Exactly one unchanged retained product WASM');
const inputs = Object.keys(built.metafile.inputs).filter(name => name !== 'apps/image-worker/canary-entry.mjs');
for (const name of ['apps/image-worker/src/worker.ts', 'apps/image-worker/src/photon-runtime.ts']) assert.ok(inputs.includes(name), 'Missing actual source ' + name);
assert.ok(!inputs.some(name => /\/(workerd|workerd\.js)$/.test(name)), 'No second Photon runtime');
assert.equal([...built.outputFiles[0].text.matchAll(/initPhoton\.sync\(\s*\{/g)].length, 1, 'One product initializer');
const sourceNames = [...new Set([...inputs, 'apps/image-worker/wrangler.toml', 'apps/image-worker/package.json', 'pnpm-lock.yaml', path.relative(root, wasmPath)])].sort();
const sourceHashes = Object.fromEntries(sourceNames.map(name => [slash(name), hash(fs.readFileSync(path.resolve(root, name)))]));
const config = {
  account_id: accountId, name: 'xivdyetools-image-acceptance-20261028', main: 'worker.mjs',
  compatibility_date: '2024-12-01', compatibility_flags: ['enable_request_signal'],
  workers_dev: false, preview_urls: false, observability: { enabled: false },
  no_bundle: true, rules: [{ type: 'CompiledWasm', globs: ['**/*.wasm'], fallthrough: false }],
};
const token = crypto.randomBytes(32).toString('hex');
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, 'entry.mjs'), entry);
fs.writeFileSync(path.join(output, 'worker.mjs'), built.outputFiles[0].contents);
fs.copyFileSync(wasmPath, path.join(output, 'photon.wasm'));
fs.writeFileSync(path.join(output, 'wrangler.json'), JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'token.txt'), token + '\n', { mode: 0o600 });
fs.writeFileSync(path.join(output, '.dev.vars'), 'ACCEPTANCE_TOKEN=' + token + '\nACCEPTANCE_DEADLINE=' + deadline + '\n', { mode: 0o600 });
const artifacts = Object.fromEntries(['entry.mjs', 'worker.mjs', 'photon.wasm', 'wrangler.json'].map(name => [name, hash(fs.readFileSync(path.join(output, name)))]));
assert.equal(artifacts['photon.wasm'], sourceHashes[slash(path.relative(root, wasmPath))]);
for (const [name, sha256] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.resolve(root, name))), sha256, 'Source changed during preparation');
const proof = { createdAt: new Date().toISOString(), deadline, accountId, sourceRoot: root, sourceHashes, artifacts,
  templateSHA256: hash(fs.readFileSync(templatePath)), generatorSHA256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  esbuildVersion: esbuild.version, node: process.version, wasmModuleCount: 1, productInitializerCount: 1,
  description: 'Unchanged real product source and retained WASM, plus explicit auth/fixture/outbound/diagnostic wrapper. Local preparation only.' };
fs.writeFileSync(path.join(output, 'provenance.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ output, deadline, artifacts, sourceCount: sourceNames.length, remoteStarted: false }, null, 2));
