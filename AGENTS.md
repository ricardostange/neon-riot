# Game version

Every PR must increment the game version once, including documentation-only PRs.
Use a patch increment by default (1.0.0 → 1.0.1 → 1.0.2).
Update both the visible `.game-version` footer in `index.html` and the
`CACHE_NAME` version suffix in `sw.js` to the same version. This also refreshes
the offline asset cache. Check the latest target branch before choosing the
number so separate PRs do not ship the same version.

Keep the version label small and inside the start menu only, below its content.

# Architecture and safe changes

- `game.js` owns mutable run state, simulation order, combat and DOM coordination.
  Keep one authoritative player/run; pass accessors when a module must follow restarts.
- `balance.js` owns difficulty data and shared scaling formulas. It is pure and
  deeply frozen. Time inputs are simulation seconds, not wall-clock time.
- `geometry.js` owns pure collision/interception math.
- `upgrades.js` keeps each in-run upgrade's limits, preview and effect together.
  `progression.js` owns saved profiles, workshop purchases and Scrap rewards.
- `renderer.js` receives a read-only frame snapshot; never mutate entities there.
  Preserve draw order and random-call order during behavior-preserving refactors.
- `audio.js` owns audio context, sound throttles and pickup notes. Reset per-run
  audio state on restart. `gamepad.js` owns controller polling and input edges.
- `i18n.js`: use stable message keys and named parameters for new dynamic text.
  `message()` is plain text for textContent; legacy t/html support existing copy.
- Production script order lives in `index.html`; the test harness reads it.
  Add every new runtime file to the complete offline snapshot in `sw.js`.
- Run `node tests/check.cjs` before opening a PR. For simulation changes also run
  `node tests/runs.cjs 3`; for UI/input/render changes use `tests/browser.cjs` when
  Playwright is available. Do not change balance or save format in a refactor.
