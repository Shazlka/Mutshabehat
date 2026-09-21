# 12 — Reversible batch rollback

## Safety invariant

Rollback restores the effective annotation aggregate; it never erases its audit trail. In
particular, `qiraat_annotation_revisions` keeps its restrictive foreign key and is never hard
deleted by a batch rollback.

`qiraat_batches` records lifecycle state. A committed/applied batch may transition once to
`rolled_back`; a second request is a safe no-op. A failed conflict leaves the original lifecycle
state unchanged.

## Aggregate snapshots

Each `qiraat_batch_changes` row represents one `annotation_aggregate`, not an unsafe partial
parent-row mutation. Its snapshots include:

- annotation core fields, anchors, scope, context, taxonomy, inheritance, status and colour;
- faces;
- annotation-level and face-linked variants; and
- source associations.

The snapshot is captured after the batch mutation as well as before it. The post-mutation version
is used to prevent a rollback from overwriting a subsequent edit.

## Operation semantics

| Original operation | Rollback action |
|---|---|
| INSERT | Soft-delete the newly created annotation, preserving creation history and creating a new revision/version. |
| UPDATE | Restore the complete pre-batch aggregate. Child variants are cleared before faces, then faces, variants and sources are restored in referentially safe order. |
| DELETE | Restore the pre-delete aggregate and clear its effective deletion state. |

Versions are monotonic. For example, an annotation at v4 that a batch writes as v5 restores its
v4 content as v6. The normal annotation update/revision/cache triggers perform the new version and
append-only revision write.

## Conflict and atomicity

Before reversing UPDATE or DELETE, `rollback_qiraat_batch(uuid)` compares the live annotation
version with the batch change's captured post-mutation version. A mismatch raises
`ROLLBACK_CONFLICT annotation <uuid>`. The function runs in the caller transaction, so a conflict
rolls back every earlier reverse operation and leaves both cache and batch status unchanged.

## Cache consistency

Annotation triggers refresh the flattened `resolved_qiraat_cache` within the same transaction.
The Phase 4 cache correction clears the old scope/authority projection before rebuilding the new
one, which covers scope/authority updates without a corpus-wide rebuild. Soft-deleted annotations
therefore disappear from effective cache output; restored aggregates re-enter it.

## Validation

Run the isolated database regression against the self-hosted test database:

```bash
npm run test:qiraat:batch
```

The test deliberately terminates its outer transaction with an expected sentinel and then checks
that no `phase4` fixture records escaped. It covers INSERT/UPDATE/DELETE mixed rollback, full child
restoration, revision/version monotonicity, cache restoration and isolation, double rollback,
post-batch edit conflict, atomicity, and soft-delete replacement behavior.
