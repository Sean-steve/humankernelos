# HumanKernelOS Production Runbook

## Pre-deployment

Confirm:

- `NODE_ENV=production`
- `SUPABASE_URL` uses HTTPS
- `SUPABASE_PUBLISHABLE_KEY` is configured
- `SUPABASE_SECRET_KEY` is stored only in the server secret store
- `SUPABASE_SERVICE_ROLE_KEY` is used only as a legacy fallback
- `HOS_EXECUTION_SHARED_SECRET` is at least 32 characters when Execution OS is used
- `EXECUTION_OS_BASE_URL` uses HTTPS when Execution OS is required
- no secret value is present in browser-exposed `VITE_*` variables

## Deploy

1. Apply committed Supabase migrations to the intended HumanKernelOS project.
2. Run Supabase security and performance advisors.
3. Verify all public-schema user data tables have RLS enabled.
4. Deploy HumanKernelOS.
5. Verify `GET /api/v1/health` returns HTTP 200.
6. Verify `GET /api/v1/readiness` returns HTTP 200.
7. Sign in and open Platform Studio.
8. Confirm Production Certification is not `blocked`.
9. If Execution OS is required, connect/validate/enable it and confirm remote readiness.
10. Run at least one signed external event and one governed capability call.

## Runtime monitoring

Watch:

- operational engines with degraded/failed/unresponsive health
- capability invocation failures
- Event Mesh dead letters
- connector degradation
- permission-denied events
- remote lifecycle rejections
- external ingress rate-limit/replay-conflict logs

Any Event Mesh dead letter is a production certification blocker.

## Incident response

When a user-facing production fault occurs:

1. Preserve the request/correlation ID.
2. Check Platform Studio production gate and observability.
3. Identify whether the failure is Kernel, Event Mesh, database, connector, or external-engine scoped.
4. Suspend a faulty external engine before changing Kernel behavior.
5. Do not bypass consent, RLS, or lifecycle gates to restore service.
6. Record remediation in the audit trail and incident notes.
7. Re-run the production certification gate before declaring recovery.

## Execution OS failure

If Execution OS becomes unavailable:

- HOS Personal Kernel remains authoritative and available.
- HOS must stop new external capability calls when the engine is not operational.
- HOS Daily Plan remains authoritative.
- Local suspend/disable remains effective even when remote PAUSE fails.
- Do not delete the external engine state during an outage.
- Restore connectivity, validate readiness, then resume through Platform Manager.

## Release rollback

Rollback application code to the last certified commit when:

- a security regression is found;
- migrations are backward compatible with the rollback;
- Event Mesh or authentication becomes unreliable;
- critical production gates remain failed after remediation.

For database changes, use the disaster-recovery procedure rather than ad-hoc destructive SQL.
