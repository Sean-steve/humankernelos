# HumanKernelOS Disaster Recovery

## Recovery objectives

Initial production targets:

- RPO: 24 hours maximum until PITR/backup cadence is formally configured
- RTO: 4 hours for application recovery
- External engine outage must not prevent the Personal Kernel from loading or preserving its own authoritative state

These are operating targets, not claims that the connected infrastructure currently satisfies them.

## Backup evidence

Production certification requires:

```
HOS_BACKUP_VERIFIED_AT=<ISO-8601 timestamp>
```

The timestamp may be set only after an operator has confirmed a real backup exists for the production HumanKernelOS database.

Evidence expires after 30 days.

## Restore-drill evidence

Production certification also requires:

```
HOS_RESTORE_DRILL_VERIFIED_AT=<ISO-8601 timestamp>
```

Set it only after restoring a production-compatible backup into an isolated environment and verifying the checks below.

Evidence expires after 90 days.

## Restore drill checklist

On an isolated project/database:

1. Restore the selected backup.
2. Verify Auth user linkage remains intact.
3. Verify RLS is enabled on exposed user tables.
4. Verify a test user cannot read another user's rows.
5. Verify Engine Registry state.
6. Verify Daily Plan and Human State rows.
7. Verify Event Mesh event/delivery ledgers.
8. Verify capability invocation history.
9. Verify audit history.
10. Verify external engine configuration contains references/config only and no browser-exposed secret.
11. Run the application production build against the restored database.
12. Run health/readiness checks.
13. Run one authenticated Personal Kernel workflow.
14. Run one Event Mesh workflow.
15. If Execution OS is part of the deployment, run one signed external event and one capability request.

Only after all checks pass should the restore-drill evidence timestamp be updated.

## External engine data

Execution OS remains an independent persistence boundary. A HumanKernelOS database restore does not restore Execution OS private runtime state.

Recovery therefore has two independent tracks:

- HOS restores identity bindings, plan authority, Human State evidence, permissions and integration metadata.
- Execution OS restores its own execution/runtime persistence.

After both are restored, reconcile through the signed HOS boundary. Do not copy one database into the other.

## Data-loss handling

If HOS is restored to an earlier point than Execution OS:

- HOS remains authoritative for the final Daily Operating Plan.
- delayed Execution OS events may be re-delivered using their original event IDs.
- HOS durable replay protection deduplicates previously processed events.
- same-ID/different-body conflicts are rejected for investigation.
- schedule changes outside current HOS delegation return as proposals.

## Certification truth rule

Never set backup or restore evidence timestamps merely to make the production gate green. They represent completed operational evidence, not configuration intent.
