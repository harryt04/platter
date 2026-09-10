# Mongo local development investigation

## DEBUG REPORT

- **Symptom:** The web process stalled on Mongo selection, while the worker and
  realtime processes could not resolve their Mongo host.
- **Root cause:** The hosted Mongo endpoint closed the driver connection during
  handshake. The standalone Node processes also did not load the env files that
  Next.js loads, and the default replica-set URI could discover Docker's
  container-only member hostname from a host-run process.
- **Fix:** Added ignored `.env.local` local-Mongo overrides, changed the local
  default to a direct loopback connection, and made standalone scripts load
  `.env.local` before `.env` while preserving exported variables.
- **Evidence:** Local Mongo answered `ping`, reported replica set `rs0` and a
  writable primary; indexes and migration completed; worker and realtime
  reported ready; `/discover` returned HTTP 200.
- **Regression test:** `tests/unit/load-env.test.ts` verifies env-file
  precedence and exported-variable precedence.
- **Status:** DONE_WITH_CONCERNS — local development is verified; the hosted
  endpoint still requires its server/tunnel configuration to be repaired.
