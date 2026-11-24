# Qiraat account and progress sync

The iOS and Android Debug builds connect to the same Neon development project. Open **Settings → Account & Sync** (الحساب والمزامنة) and use the same account on both devices. The sign-in page supports email registration, email sign-in, and the Neon development Google client.

The first sign-in offers a choice to copy guest progress before opening the reader. **Copy guest progress to account** copies each dataset that has no account progress locally or in Neon. Progress syncs on foreground entry, every minute in the foreground, and when requested in Account & Sync. If both devices change the same dataset before syncing, choose which copy to keep in Account & Sync. Khatma and memorization have independent revisions.

## Development deployment

- Neon project `plain-dream-33493148`, branch `development` (`br-still-sunset-bgeylsq4`).
- Function `qiraatsync` at `https://br-still-sunset-bgeylsq4-qiraatsync.compute.c-9.eu-central-1.aws.neon.tech`.
- Managed Auth issuer `https://ep-silent-frost-bglqosbx.neonauth.c-9.eu-central-1.aws.neon.tech/neondb/auth`.
- OAuth public client ID `MrnWcXbCmpeSORVQYKQMXIolZygFSpNc`.

Run `npm ci` and `npm run build` in this directory. Package the contents of `dist/` with `index.mjs` at the ZIP root, and deploy the ZIP to the Neon Function on the matching branch. On a new Neon project apply `schema.sql` once as the database owner, and set the Function variables `NEON_AUTH_URL` and `QIRAAT_ORIGIN`. Neon injects `DATABASE_URL`. The runtime role has select, insert, and update access and uses PostgreSQL row policies bound to the authenticated OAuth subject.

Add the Function origin to Neon Auth's trusted domains and configure it as an OAuth resource. Set the OAuth login and consent pages to `/auth/sign-in` and `/auth/consent` on that origin. Register a public PKCE client with `/auth/mobile-callback` as its HTTPS redirect URI. OAuth discovery names the Neon authorization and token endpoints. The callback offers a return link to the installed native app.

## Release connection

Configure a separate production branch, Function, and OAuth client before shipping. Use app-owned Google OAuth credentials for production. Feed `QIRAAT_CLOUD_ORIGIN`, `QIRAAT_CLOUD_ISSUER`, and `QIRAAT_CLOUD_CLIENT_ID` into the iOS Xcode build settings and the Android Gradle project properties. These are public connection identifiers. Keep database and Google secrets in Neon or the host's secret storage.

## What syncs

Every subject has a separate cloud row per dataset, and each app opens separate SQLite files for the signed-in account. The sync payload covers khatma, read ayahs, daily reading activity, memorization records, review history and goals. Bookmarks and device preferences are local. Changes are applied in SQLite transactions. Updates require the current cloud revision. SQLite schema and device identity metadata stay local.

Use a test account to check both directions on iOS and Android. Record a khatma change on one device and a memorization change on the other, sync both, then verify the other device displays each change. Use a second account to confirm its progress starts empty. With two devices offline, edit the same dataset on both and confirm each copy stays available until the user resolves the conflict.
