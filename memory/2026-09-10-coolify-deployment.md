# Coolify deployment investigation — 2026-09-10

**DEBUG REPORT**

- **Symptom:** Coolify builds the Platter image and reports that the new
  container started, but the deployment is not usable.
- **Root cause:** The Nixpacks plan has an empty `start` phase. The repository
  defines `start:web`, `start:realtime`, and `start:worker`, but no plain
  `start` script. Local verification with `npm run start` fails with
  `Missing script: "start"`.
- **Fix:** Not applied. Configure the Coolify web resource to run
  `npm run start:web`, or add a root `start` script that delegates to it.
- **Evidence:** The deployment log prints `start │` with no command after a
  successful build. `package.json` contains only the named process-specific
  start scripts. The repository deployment notes document three separate Node
  processes, so one web resource also does not provide realtime or worker
  services.
- **Regression test:** Local command verification only; no source change was
  made.
- **Related:** Coolify is building with Node 22.19.0 while `package.json`
  requires Node 24.x; npm emits engine warnings, including one dependency
  requiring Node `^20.20.0 || >=22.22.0`. The generated Dockerfile also places
  sensitive environment values in `ARG`/`ENV`, which BuildKit warns about.
- **Status:** DONE_WITH_CONCERNS — root cause identified, but the live
  container could not be inspected from this workspace.
