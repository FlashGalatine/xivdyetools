# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-25

### Added

- **REFACTOR-001**: Initial release of shared cryptographic utilities
  - `base64UrlEncode(str)` - Encode string to Base64URL (RFC 4648)
  - `base64UrlEncodeBytes(bytes)` - Encode Uint8Array to Base64URL
  - `base64UrlDecode(str)` - Decode Base64URL to string
  - `base64UrlDecodeBytes(str)` - Decode Base64URL to Uint8Array
  - `hexToBytes(hex)` - Convert hex string to Uint8Array
  - `bytesToHex(bytes)` - Convert Uint8Array to hex string

### Notes

- Created to consolidate duplicate Base64URL implementations across the ecosystem
- Zero runtime dependencies, compatible with Cloudflare Workers
- Follows RFC 4648 for Base64URL encoding (URL-safe alphabet, no padding)
