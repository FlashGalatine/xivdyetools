# FINDING-055 execution evidence — 2026-10-26

The maintainer explicitly authorized enabling Always Use HTTPS and setting minimum
TLS to 1.2 for `xivdyetools.app`. Only these two zone settings were changed.
Times below are UTC; all checks occurred on October 26 in America/New_York (EDT).
The account and zone IDs are omitted from this record.

## Preflight — 2026-10-27 03:10:57 UTC

GET /zones with the exact name `xivdyetools.app` confirmed the active zone in the
expected account. GETs of its settings returned HTTP 200 / success true:

| Setting | Before | Editable |
|---|---|---|
| always_use_https | off | true |
| min_tls_version | 1.0 | true |

## Authorized changes — 2026-10-27 03:11:13 UTC

Sequential Cloudflare API PATCH requests:

```text
PATCH /zones/<zone>/settings/always_use_https {"value":"on"}
PATCH /zones/<zone>/settings/min_tls_version {"value":"1.2"}
```

Both returned HTTP 200 / success true, errors [], and the requested value.
No HSTS, SSL mode, cipher, DNS, route, worker code or deployment setting was changed.

## Verification

At `2026-10-27 03:11:46 UTC`, independent GETs returned HTTP 200 / success true:
always_use_https = on; min_tls_version = 1.2.

HEAD probes returned 301 from HTTP to the same hostname and path over HTTPS;
following each redirect with a five-redirect limit ended at HTTPS with HTTP 200:

| Host | Initial HTTP response | Final HTTPS response |
|---|---|---|
| xivdyetools.app | 301 | 200 |
| beta.xivdyetools.app | 301 | 200 |
| api.xivdyetools.app | 301 | 200 |
| auth.xivdyetools.app | 301 | 200 |
| data.xivdyetools.app | 301 | 200 |

At `2026-10-27 03:12:22 UTC`, a Python ssl/socket probe with OpenSSL 3.5.7 connected
to data.xivdyetools.app:443, using SNI and certificate validation. Each connection
pinned both the minimum and maximum protocol version. DEFAULT:@SECLEVEL=0 allowed
the legacy protocols in the client so their failures came from the server:

| Requested protocol | Result |
|---|---|
| TLS 1.0 | rejected: TLSV1_ALERT_PROTOCOL_VERSION |
| TLS 1.1 | rejected: TLSV1_ALERT_PROTOCOL_VERSION |
| TLS 1.2 | accepted: negotiated TLSv1.2 |

The probe asserted all three outcomes and exited 0. All curl probes exited 0.
OPS-ZONE is complete; no code deploy or publish was required. Rewording the three
HSTS comments noted in FINDING-055 remains companion work for the oauth,
discord-worker and presets-api app sprints.
