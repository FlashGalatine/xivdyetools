# A-IMAGE — pre-push checksum review, 2026-10-28

The initial Gitleaks 8.30.1 redacted scan of `origin/main..1815fe82` reports 13
`generic-api-key` findings, all in the owned-buffer memory receipt committed at
`1815fe82a934262c8cf5a07bf2954f3ccc3afd54`. The flagged property name ends in
`key-scope.js`; its value is the SHA-256 checksum of
`packages/worker-kit/dist/rate-limiter/key-scope.js`, not a credential.

Independent Astra verification confirms every flagged value equals that file's
computed checksum. All **832 entries across 13 source-checksum maps** match their
current source bytes; **15/15 original receipt hashes** match, and the committed
evidence equals the inspected working file. The receipt generator computes these
checksums directly from file bytes.

Affected receipt lines: **246, 653, 1257, 1341, 1647, 1731, 1846, 1930, 2534,
2618, 2924, 3008, 3123**. Their preparation/control/vendor before-and-after maps
are preserved; no evidence value is deleted or rewritten.

The correction appends exactly the 13 finding fingerprints to `.gitleaksignore`.
Each names the original commit, file, rule and individual line. This follows the
repository's existing approach and Gitleaks'
[finding-specific exclusions](https://github.com/gitleaks/gitleaks/blob/v8.30.1/README.md#gitleaksignore).
The fingerprints do not exempt new commits. `.gitleaks.toml`, all secret rules and
path coverage remain unchanged; no whole-file/path exclusion is added.

The scanner was downloaded only to the ignored local tool folder from the official
`gitleaks/gitleaks` v8.30.1 release. Its Windows archive SHA-256 matches the official
checksums file. Initial findings, checksum proof, the final redacted full-range
rescan and synthetic detection control remain under this task's ignored
`push-scan/` workspace. Scanner configuration/evidence changes do not change the
application source, artifact, test assertions or production activation hold.
