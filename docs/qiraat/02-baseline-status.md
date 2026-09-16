# Mutshabehat V2: Baseline Safety Status & Pre-Flight Verification
**Date:** 2026-09-16  
**Document:** `docs/qiraat/02-baseline-status.md`  
**Phase:** Phase B — Backup and Safety Baseline

---

## 1. Safety Database Backup

Before introducing any migrations or data additions for the Qira’at feature, a complete binary custom-format PostgreSQL dump was created:
- **Location:** `/Volumes/External Mini/Projects/apps/mutshabehat-selfhost/backups/pre-qiraat-phase1-20260916.dump`
- **File Size:** 3,924,066 bytes (~3.9 MB)
- **Schemas Backed Up:** `public`, `auth`
- **Command:**
  ```bash
  docker exec mutshabehat-db pg_dump -U postgres -d postgres --schema=public --schema=auth -Fc > "/Volumes/External Mini/Projects/apps/mutshabehat-selfhost/backups/pre-qiraat-phase1-20260916.dump"
  ```
- **Exit Status:** 0 (Clean)

---

## 2. Test Suite & Validation Baseline

| Test Suite / Command | Exit Code | Results / Details | Status |
|---|---|---|---|
| `npm run mushaf:validate` | 0 | 7/7 validator suites passed: objective source, page-order (83,665 tokens, 226 header slots), page-word (604 pages), navigation, Supabase interaction, page ayat, phase 6 iPhone readiness. | ✅ PASS |
| `npx tsc --noEmit -p .` | 0 | Full project TypeScript check completed with 0 errors. | ✅ PASS |
| `set -a; source .env.local; set +a; npm run test:proxy` | 0 | Auto-login & session cookie propagation unit test passed (290 ms). | ✅ PASS |
| `env -u __NEXT_PROCESSED_ENV npm run build` | 0 | Next.js 16.2.6 production build with Turbopack compiled successfully in 6.8s; all 28 routes generated. | ✅ PASS |
| `npm run lint` | 1 | Pre-existing baseline: 36 errors, 16 warnings (React 19 stricter rules regarding `set-state-in-effect` and unused variables in legacy components). Documented in `HANDOFF.md` §3 as existing baseline. | ⚠️ PRE-EXISTING BASELINE |

---

## 3. Backend Containers Health

| Container | Status | Port Mapping | Health |
|---|---|---|---|
| `mutshabehat-db` | Up (healthy) | `127.0.0.1:5433->5432/tcp` | Postgres 17 responding |
| `mutshabehat-auth` | Up (healthy) | internal `9999` | GoTrue 2.189.0 responding |
| `mutshabehat-rest` | Up (healthy) | internal `3000` | PostgREST 14.12 responding |
| `mutshabehat-gateway` | Up (healthy) | `127.0.0.1:8000->80/tcp` | Caddy reverse proxy routing cleanly |
| Tailscale Funnel | Active | `:8443 -> 127.0.0.1:8000` | Gateway reachable via Funnel |

---

## 4. Conclusion & Gate Assessment

The codebase and backend database are fully functional, stable, and backed up. No pre-existing blockers prevent proceeding with Phase C (Identify Source Page) and Phase D (Extract Page 1 Data).
