/**
 * Download — hand the browser a text file to save.
 *
 * One anchor with a `download` name, clicked once and removed, its object URL
 * revoked straight after. Shared so that every "save as a file" action makes
 * the same three moves and forgets none of them.
 *
 * @module shared/download-file
 */

/** Save `text` as `filename` with the given MIME type. */
export function downloadTextFile(text: string, filename: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
