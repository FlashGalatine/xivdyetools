/**
 * GitHub Webhook Payload Types
 *
 * Types for the GitHub `push` webhook event used to detect
 * changelog updates and trigger Discord announcements.
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 * @module types/github
 */

export interface GitHubPushPayload {
  /** Full git ref, e.g. "refs/heads/main" */
  ref: string;

  /**
   * Head SHA of the ref after the push (40 hex characters). The announce
   * handler fetches the changelog at this commit rather than at the `main`
   * branch URL, which GitHub's raw CDN caches for minutes.
   */
  after: string;

  /** Array of commits included in the push */
  commits: GitHubCommit[];

  /** Repository metadata */
  repository: {
    full_name: string;
    html_url: string;
  };

  /** The most recent commit of the push (null for branch deletions) */
  head_commit: GitHubCommit | null;
}

export interface GitHubCommit {
  /** Full SHA hash */
  id: string;

  /** Commit message */
  message: string;

  /** Files added in this commit */
  added: string[];

  /** Files modified in this commit */
  modified: string[];

  /** Files removed in this commit */
  removed: string[];

  /** URL to the commit on GitHub */
  url: string;

  /** ISO 8601 timestamp */
  timestamp: string;
}
