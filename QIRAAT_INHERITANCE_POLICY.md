# Qiraat inheritance policy

`applies_to_descendants` governs propagation for every action. A direct target annotation always wins; otherwise the nearest ancestor with propagation enabled wins (Tariq > Narrator > Reader).

| Action | false | true |
|---|---|---|
| INHERIT | target only | target and descendants |
| OVERRIDE | target only | target and descendants until a nearer rule |
| EXCLUDE | target only | target and descendants until a direct/nearer rule |

For Reader → Narrator → Tariq, a Reader inherited rule reaches Tariq only when enabled. A Narrator override with propagation disabled changes the Narrator only; enabled, it is Tariq's nearest inherited rule. A direct Tariq override supersedes either inherited override or exclusion. No hard-exclude action exists.

The write-time cache mirrors this exact resolver policy. Page reads query `resolved_qiraat_cache` only and never recurse through the hierarchy.

Resolver/cache coverage is executed in `tests/qiraat/resolver-cache.test.sql` inside one transaction which intentionally rolls back. It covers propagation, direct precedence, nearest eligible ancestor, sibling and unrelated-branch isolation, soft-delete fallback, and cache parity at each assertion.
