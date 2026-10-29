# Chat research aggregate publication

**Status:** Implementation authorized by the maintainer on 2026-10-29 for PR #317.

The approved PR follow-up identified linkable account records and collectors that
recreate raw identifiers. The public research needs useful cohort measurements
without publishing a dossier about an individual.

## Design

- Remove individual, ranked and pseudonymous account records, cross-platform
  pairs, activity histories, hand counts and identifying narrative from the
  research evidence and reports. Keep useful whole-query and cohort aggregates.
- Official and organization references in prose may stay. Machine-readable
  evidence contains aggregate results only, with no profile or creator rows.
- Build each collector result from fixed schema fields. Keep identifiers and
  source text in memory only for matching, deduplication and counting.
- Export profile audience measurements only as three broad follower bands, with
  the entire table suppressed if any occupied band has fewer than five distinct
  subjects. Never publish exact profile-count sums or account comparison rows.
- Require at least five distinct contributors for subject-derived collector
  metrics; matching-post subsets must meet that threshold independently.
  Suppress the entire metric set rather than reveal a small complement.
- Nonzero pooled feed/pack measurements need five distinct positive
  contributors; zero-valued records cannot pad a publishing cohort. Focus
  metrics require sufficient sampled, classifiable and matching subjects.
- Collector diagnostics and failures use fixed messages and operational counts;
  never echo remote text, command arguments, credentials or local file paths.
- Use synthetic network and socket fixtures to verify actual stdout, stderr,
  error paths, suppression and deduplication without contacting social services.

## Approach and scope

An output allowlist plus cohort suppression is the chosen implementation.
Replacing labels or scrubbing selected strings would preserve numerical
fingerprints and miss future fields. Removing the collectors would discard the
maintainer's requested measurement workflow.

This change minimizes the current tree. Historical aggregate captures cannot be
certified against new contributor thresholds because contributor identities were
already removed. Existing Git commits and GitHub cached views require separate
history/removal handling; editing the current tree does not purge them.

Primary-source platform research, new live measurements, adapter implementation,
merging, deployment and history rewrites are outside this remediation.
