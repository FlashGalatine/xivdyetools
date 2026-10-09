/**
 * What a command's failure log line says about the error it caught (BUG-125).
 *
 * The error's class and, for an AppError, its code — never its message. A
 * message can quote what it was given: core's colour helpers quote the hex
 * ("Invalid hex color: …"), which can be what the user typed, and the .chara
 * parser quotes field values from the player's file (PRIVACY_POLICY §3). A
 * thrown non-Error is named by its type alone, for the same reason.
 *
 * Internal to the commands — not part of the package's public API.
 *
 * @module commands/failure-kind
 */
export function failureKind(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? `${error.name} ${code}` : error.name;
}
