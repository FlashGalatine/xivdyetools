// Repro for the sanitizeErrorMessage unquoted-value arm: does it stop at the first space?
import { BaseLogger } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/logger/dist/index.js';

class Probe extends BaseLogger {
  write() {}
  formatMessage(m) {
    return m;
  }
  expose(s) {
    return this.sanitizeErrorMessage(s);
  }
}
const p = new Probe({ level: 'debug' });

const cases = [
  'Authorization: Basic dXNlcjpwYXNzd29yZA==',
  'token = my secret value',
  'password = hunter2 correct horse',
  // Deliberately low-entropy and self-describing: this case is a CONTROL (the
  // unquoted-no-spaces shape already redacted correctly), and a realistic-looking
  // key here trips the repo's own gitleaks generic-api-key rule on an audit
  // artefact that contains no real credential.
  'api_key=not-a-real-key',
  'token="quoted secret value"',
  'Authorization: Bearer eyJhbGciOi.J9.sig',
];

for (const c of cases) {
  const out = p.expose(c);
  console.log(`in : ${c}\nout: ${out}\n`);
}
