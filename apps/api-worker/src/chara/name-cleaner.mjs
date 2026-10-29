/**
 * Shared Worker/build-time name boundary; no Node APIs.
 * @param {unknown} value
 * @returns {string}
 */
export function cleanName(value) {
  if (typeof value !== 'string') return '';
  // Preserve word boundaries before removing the controls that include tabs/newlines.
  // eslint-disable-next-line no-control-regex -- Explicitly remove untrusted name controls.
  const text = value.replace(/[\s\u0085]+/gu, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').replace(/[\s\u0085]+/gu, ' ').trim();
  let result = '';
  let count = 0;
  for (const point of text) {
    if (count++ === 128) break;
    result += point;
  }
  return result;
}
