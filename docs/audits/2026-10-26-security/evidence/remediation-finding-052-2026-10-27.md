# FINDING-052 execution evidence — 2026-10-27

The maintainer authorized tagging published xivcharakit releases in
FlashGalatine/XIVCharaKit so each library version maps to its source commit.

## Verified release mapping

| npm version | Annotated Git tag | Source commit |
|---|---|---|
| 0.1.0-beta.1 | [chara-v0.1.0-beta.1](https://github.com/FlashGalatine/XIVCharaKit/tree/chara-v0.1.0-beta.1) | 90abb4721b35b3c8d564e8c1a6855fd8c9de0e8a |
| 0.1.0-beta.2 | [chara-v0.1.0-beta.2](https://github.com/FlashGalatine/XIVCharaKit/tree/chara-v0.1.0-beta.2) | 8f30f7b4a20b857a5efa1aa1dc4c0b0d9ed1b48b |
| 0.1.0-beta.3 | [chara-v0.1.0-beta.3](https://github.com/FlashGalatine/XIVCharaKit/tree/chara-v0.1.0-beta.3) | 39b849fb585eb2bb7d31ce139593fab5afaeb530 |
| 0.1.0-beta.4 | [chara-v0.1.0-beta.4](https://github.com/FlashGalatine/XIVCharaKit/tree/chara-v0.1.0-beta.4) | 18a91afee6d29ea89d456c33a145e5a2ee4c3710 |

## Source evidence

- [Registry metadata](xivcharakit-release-tags-2026-10-27.registry.json) lists five
  versions. The [mapping](xivcharakit-release-tags-2026-10-27.mapping.json) records
  integrity and publication evidence for the four library releases.
- Beta.1 has no npm gitHead or provenance. The retained candidate from GitHub
  Actions run 39541256961 is byte-identical to its registry tarball; SHA-512 equals
  both registry integrity and the [original manifest](xivcharakit-beta1-reviewed-candidate/release.json),
  which names source commit 90abb4721b35b3c8d564e8c1a6855fd8c9de0e8a.
  [Artifact comparison](xivcharakit-release-tags-2026-10-27.legacy-artifact-checks.json).
- Beta.2, beta.3 and beta.4 registry SLSA provenance statements identify the mapped
  commit, expected repository, main ref and publish.yml workflow. Subject SHA-512
  digests equal registry integrity. Saved bundles:
  [beta.2](xivcharakit-0.1.0-beta.2-attestations.json),
  [beta.3](xivcharakit-0.1.0-beta.3-attestations.json),
  [beta.4](xivcharakit-0.1.0-beta.4-attestations.json).
  Payloads and digests were checked; no new cryptographic Sigstore verification
  is claimed by this tagging task.
- [Source package checks](xivcharakit-release-tags-2026-10-27.source-checks.json)
  confirm name xivcharakit and the matching version at every mapped commit.
- An independent read-only gpt-6.1-sol/xhigh verifier confirmed all four mappings.

## Placeholder exception

The 0.0.0-stage tarball is npm's temporary holding package: stub=true and only
package.json plus a Temporary Holding Version README. It contains no library
code, provenance or gitHead. Its integrity was verified and its file list saved
in the artifact comparison. No source commit was invented and no tag was created
for this registry-generated placeholder.

## Creation and verification

All four tag names were absent before creation. The coordinator created annotated
tag objects and new refs/tags/chara-v... references through GitHub's Git Database
API, without updating any existing reference. Annotations include package version,
source commit, tarball integrity and publication evidence. The tagger uses the
account's public GitHub noreply identity. [Creation receipts](xivcharakit-release-tags-2026-10-27.created.json).

At 2026-10-27 04:07:21 UTC, [fresh verification](xivcharakit-release-tags-2026-10-27.verification.json)
confirmed every tag object resolves to the expected commit, tagged package metadata
matches the npm version, and each annotation contains the verified integrity.
[git ls-remote](xivcharakit-release-tags-2026-10-27.remote-tags.txt) independently
confirmed all four annotated refs and peeled commit targets.

The main ref remains bf6009fb1ff02eb64b40cdec9e6295ee11da805f. npm tarball
integrities and dist-tags are unchanged (latest beta.1, next beta.4). No GitHub
Release, npm publish, workflow change or application deployment was performed.
FINDING-052 is fixed for the current published library release set and
OPS-XIVCHARAKIT-PROVENANCE is complete. Future publishes need matching source tags;
publish-workflow tagging automation remains follow-up work.
