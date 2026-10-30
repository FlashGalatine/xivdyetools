/**
 * Largest `.chara` file accepted by the live import facade and its transports:
 * 8 KiB of the original bytes, not decoded UTF-16 text length.
 *
 * `inspectCharaForTools` enforces this cap on byte input and UTF-8-encoded
 * string input. The browser's File.size and the bot's attachment-size and
 * streamed-download guards also enforce it before import.
 *
 * Exports without an attached image measured 1,837–2,777 bytes over a
 * 1,093-file corpus. The one larger file carried an attached Base64 image
 * (3,128,021 bytes), so those files are refused with guidance to save again
 * without the image. A file under the cap still has to parse.
 */
export const MAX_CHARA_FILE_BYTES = 8 * 1024;
