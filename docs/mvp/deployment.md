# Platter deployment notes

The foundation runs three Node processes: the Next.js web process, a separate
Socket.IO realtime process, and an Agenda worker. Put a same-origin reverse
proxy in front of the web process and route the realtime origin to the
Socket.IO port with WebSocket upgrade support. Set `APP_URL`,
`BETTER_AUTH_URL`, and `ALLOWED_ORIGINS` to the public origin.

MongoDB must be a replica set, including for a single-node deployment. Set an
explicit `MONGODB_DATABASE`; do not share the development database with tests.
Run `npm run db:indexes` and `npm run db:migrate` as part of release setup.

Configure hosted SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and optional
credentials. Password reset links must use the canonical HTTPS application
URL. PostHog remains disabled unless `POSTHOG_ENABLED=true` and both public
PostHog settings are present; the adapter never sends recipe or grocery
content. Google sign-in is reserved for a later release and requires
human-created OAuth credentials and approved redirect URIs.
