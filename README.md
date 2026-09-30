# NEON RIOT

A compact neon survival roguelike inspired by Vampire Survivors and twin-stick arcade shooters. Original code, procedural graphics, synthesized audio. No build step or runtime dependencies.

## Play

```sh
./run.sh
```

Open **http://localhost:8000**. Use `PORT=3000 ./run.sh` for a different port, or simply open `index.html` directly.

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Space | Dash, shred enemies, and erase bullets |
| 1 / 2 / 3 | Choose an upgrade |
| R | Reroll a draft — two per run |
| P / Escape | Pause / resume |
| M | Toggle sound |
| F | Fullscreen |

Touch screens get an analog movement stick and dash button. Menus support keyboard navigation. The game pauses when you switch tabs or lose window focus.

## Same short run. Sharper chaos.

**The boss still arrives at 03:00.** No extra stages, grinding, or permanent power progression.

- Weapons automatically target the closest eligible enemy and lead moving targets. No mouse aiming or clicking required.
- Desktop uses the original 1:1, wider arena view. Small screens scale down to keep the action visible.
- Dash hits the whole path, not just your landing point. Dash kills refund up to 0.8 seconds of cooldown per dash.
- Green shards level you up. Pink crosses repair hull and remain on the ground while you're at full health.
- Upgrade effects stack. Cards show exact before/after stats, ranks, and build matches. Every draft includes an offensive option.
- Shooters lock their aim during visible windups. The boss alternates radial volleys and aimed fans, then accelerates at half hull.
- Shockwaves knock enemies back and erase projectiles. All loose XP is pulled toward you when the boss arrives.
- Kill chains reward clean play with feedback and a personal run stat; getting hit or going 2.5 seconds without a kill resets the chain. No hidden damage multiplier.
- The results screen breaks down damage by weapon, best chain, and dash kills.
- Sound and **FX CALM** preferences save locally, alongside your best elimination count. Calm mode reduces particles and disables screen shake, hit flashes, and decorative animation; attack warnings remain visible. It defaults on for reduced-motion system preferences.

Try multishot + piercing, orbiting blades + speed, or shockwaves + a giant pickup radius.

Everything works offline. Optional Google Fonts fall back to system fonts. The server binds only to localhost.

## Install and play offline

Serve over HTTPS (or localhost), open the game in Chrome on Android, and choose **Install app** from the browser menu. Installation availability is controlled by the browser. Opening a local file directly does not enable installation or the service worker.

After the first successful online load and service-worker installation, the game can reopen offline. Optional Google Fonts use system fallbacks offline. Relative manifest and worker URLs support both a domain root and GitHub Pages project paths.

When deploying changes to cached files, bump the version in `sw.js`. Close all game windows and reopen to activate the update; an active run is never forcibly reloaded.

## Checks

```sh
node --check game.js
node tests/smoke.cjs
node tests/runs.cjs 3
```

- **Smoke tests:** 21 regression checks, including closest-enemy targeting, target eligibility, the wider desktop view, swept collisions, pierce ordering, dash immunity, telegraphs, drafts, healing, XP conservation, death/victory, refresh-rate independence, and settings.
- **Run simulations:** deterministic full runs with a simple movement/drafting pilot, plus an invulnerable stress run. These check mechanics and pacing, not human difficulty.

Optional real-browser checks require Playwright and its Chromium browser:

```sh
# In a separate temporary directory, keeping game dependencies at zero:
npm install --prefix /tmp/riot-test-tools playwright
/tmp/riot-test-tools/node_modules/.bin/playwright install chromium
# Start ./run.sh in another terminal, then:
NODE_PATH=/tmp/riot-test-tools/node_modules node tests/browser.cjs
```

Playwright may also require its documented system libraries on a minimal Linux installation. Set `RIOT_URL` if using a different server port. Screenshots go to `/tmp/neon-riot-screenshots` (override with `RIOT_SCREENSHOTS`). Browser checks cover keyboard interactions, accidental held-key selections, focus navigation, drafts, boss/results transitions, persistence, reduced motion, real multitouch, and portrait/landscape layouts.

Test instrumentation is injected by `tests/harness.cjs` only; the shipped game exposes no debug controls.
