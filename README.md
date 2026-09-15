# Mutshabehat V2

Mutshabehat is a private Arabic Quranic-similarity workspace built with Next.js 16 and Supabase. The production application is [mutshabehat-v2.vercel.app](https://mutshabehat-v2.vercel.app).

## Architecture

- The V2 application source is on the default `main` branch (mirrored on `feature/mushaf-1441-module`). The legacy static V84 application is archived on branch `legacy-v84-main` and tag `legacy-v84-final`.
- Vercel hosts the Next.js application.
- Supabase-compatible PostgreSQL, Auth, PostgREST, and Caddy services run in Colima on the Mac mini.
- The self-hosted API is published through Tailscale Funnel at `https://youssefs-mac-mini.tailcd68dd.ts.net:8443`.
- The persistent Colima data root is stored on the Mac mini external SSD.
- A launchd health supervisor checks the stack every 60 seconds and restores stopped services.

The deployment is single-user. `src/proxy.ts` establishes the configured account's Supabase session when a browser has no valid session. After a successful auto-login on a safe page request, the proxy returns one same-URL redirect with the new cookies. This guarantees the retried Server Component request is authenticated and prevents an empty first render.

## Local development

```bash
npm ci
npm run dev
```

Required environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AUTOLOGIN_EMAIL
AUTOLOGIN_PASSWORD
```

## Verification

Run the proxy integration test against a healthy local self-hosted Supabase stack with the four variables above:

```bash
npm run test:proxy
npm run lint
npx tsc --noEmit
npm run build
```

Production verification must use a fresh browser context and confirm that the first navigation renders the expected group count with no page or console errors. A plain HTTP 200 is not sufficient.

## History & Changelog

### 2026-09-11 (Codex GPT-5)

- **Added**: A live proxy integration regression test for first-visit auto-login and session-cookie forwarding.
- **Removed**: Nothing.
- **Changed**: Fresh GET and HEAD requests now perform a one-time same-URL redirect after successful server-side auto-login, ensuring the first Server Component render sees the authenticated session.
- **Verification**: `npm run test:proxy` (1/1 passed); `npx eslint src/proxy.ts tests/proxy-autologin.test.mjs` (exit 0); `npx tsc --noEmit` (exit 0); `npm run build` (exit 0); Vercel production deployment `dpl_DfsCpfR9DfhtvHKk79RUFSFqdYPc` reached Ready and was aliased to `mutshabehat-v2.vercel.app`; Playwright fresh-context desktop/mobile verification repeated twice (4/4 passed, 0 page errors, 0 console errors, 0 actionable request failures, 0 HTTP responses >= 400). Repository-wide `npm run lint` remains exit 1 with 21 pre-existing errors in unrelated application files; focused lint for this change is clean.
