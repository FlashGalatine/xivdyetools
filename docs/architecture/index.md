# Architecture

How the 17 projects fit together. Start with the overview; the rest go one level deeper on a
single axis each.

| Page | Read it for |
|------|-------------|
| [overview.md](overview.md) | The ecosystem diagram, what each package and app is for, and which binding connects what |
| [dependency-graph.md](dependency-graph.md) | The package dependency layers and every workspace's runtime dependencies |
| [service-bindings.md](service-bindings.md) | Worker-to-Worker service bindings and each worker's KV / D1 / R2 / rate-limit bindings, as declared in `wrangler.toml` |
| [data-flow.md](data-flow.md) | Sequence diagrams: OAuth sign-in, preset submission and voting, market prices, bot rate limiting |
| [api-contracts.md](api-contracts.md) | The request/response contracts between workers and with the web app |
| [security-trade-offs.md](security-trade-offs.md) | The deliberate trade-offs — fail-open rate limiting, HS256-only JWTs, fail-closed moderation — and why each was chosen |

Version numbers are deliberately absent from these pages; see [../versions.md](../versions.md).
