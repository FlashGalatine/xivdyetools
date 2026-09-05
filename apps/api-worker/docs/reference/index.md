# Reference

<EndpointIndex>

All `/v1` responses use the `{ success, data, meta }` envelope — see [Responses](../guide/responses). Every row below made one real request when this page loaded: the swatches are the colours in that answer, a count means the answer carries none, and an error prints the API's own message, verbatim.

</EndpointIndex>

## Health

```bash
curl https://data.xivdyetools.app/health
```

Returns `{ "status": "ok", "timestamp": "..." }` — no envelope, no auth, no rate limiting.
