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

**The boss still arrives at 03:00.** Finish the fight, bank Scrap, improve your ship and choose a higher threat for the next run.

- Weapons automatically target the closest eligible enemy and lead moving targets. No mouse aiming or clicking required.
- Desktop uses the original 1:1, wider arena view. Small screens scale down to keep the action visible.
- Dash hits the whole path, not just your landing point. Dash kills refund up to 0.8 seconds of cooldown per dash.
- Green shards level you up. Pink crosses repair hull and remain on the ground while you're at full health.
- Upgrade effects stack. Cards show exact before/after stats, ranks, and build matches. Every draft includes an offensive option.
- Shooters lock their aim during visible windups. The boss has 24,000 hull on Street and three cores. Each destroyed core triggers 1.5 seconds of visible armor and a telegraphed counterattack; damage cannot skip cores. Later cores fire denser rings and wider fans, move faster and attack more often.
- Shockwaves knock enemies back and erase projectiles. All loose XP is pulled toward you when the boss arrives.
- The results screen breaks down damage by weapon, level reached, and dash kills.
- Sound and **FX CALM** preferences save locally, alongside your best elimination count. Calm mode reduces particles and disables screen shake, hit flashes, and decorative animation; attack warnings remain visible. It defaults on for reduced-motion system preferences.

Try multishot + piercing, orbiting blades + speed, or shockwaves + a giant pickup radius.

Everything works offline. Optional Google Fonts fall back to system fonts. The server binds only to localhost.

## Minimal combat HUD

Combat shows the timer, hull, dash cooldown, XP/level, Pause and a compact boss bar. Sound, effects and fullscreen buttons are inside Pause. Difficulty, eliminations and the current build remain available in Pause.

No branding, objective text, live kill/chain counters, loadout tiles, critical-hit numbers, dash-refund text or large combat announcements cover the arena. Damage/healing feedback, enemy telegraphs, boss armor and elite outlines remain visible. The timer turns pink in the ten seconds before the boss arrives. Health pickup frequency is reduced to a 0.6% random chance per ordinary enemy kill, with a low-health fallback every 140 kills. Touch controls sit closer to the bottom edge, with the same target sizes and movement behavior.

## Scrap and the workshop

Completed runs award Scrap on both victory and defeat. Rewards are saved immediately when the run ends. Closing or reloading an unfinished run does not award Scrap.

`Scrap = floor((survival + eliminations + victory) × threat multiplier)`

- Survival: 1 Scrap per 6 seconds, capped at 30.
- Eliminations: 1 Scrap per 10 kills, capped at 50.
- Victory: 60 additional Scrap.

A Street victory with at least 500 eliminations earns 140 Scrap. Survival and elimination rewards stop growing after their caps, so keeping the boss alive cannot generate unlimited rewards. Use **Workshop** from the menu or **Spend Scrap** on the result screen.

| Permanent upgrade | Each rank | Maximum ranks | Rank costs |
| --- | --- | --- | --- |
| Reinforced hull | +10 starting/max hull | 5 | 40, 70, 110, 170, 250 |
| Hotter rounds | +6% starting bullet damage | 5 | 40, 70, 110, 170, 250 |
| Salvage field | +10% starting pickup radius | 5 | 40, 70, 110, 170, 250 |
| Dash capacitor | −4% starting dash cooldown | 5 | 40, 70, 110, 170, 250 |
| Second opinions | +1 reroll per run | 3 | 70, 140, 240 |

Ranks add to the starting bonus, then normal run upgrades apply. Bonuses are capped so difficulty still matters. Progress is stored in this browser's localStorage, independently of existing sound, effects and personal-best settings. It is not synced across devices; clearing site data erases it. If storage writes fail, the workshop/results display a warning and progress remains usable for the current session.

## Threat levels

Beat the boss on a tier to unlock the next. Unlocked tiers remain freely selectable; **One more run** repeats your selection, while **Change difficulty** returns to the menu.

| Threat | Scrap | Spawn rate | Enemy hull | Incoming damage | Boss hull | Elite chance after 00:35 |
| --- | --- | --- | --- | --- | --- | --- |
| Street | 1× | 1× | 1× | 1× | 24,000 | 0% |
| Overdrive | 1.5× | 1.2× | 1.15× | 1.2× | 30,000 | 4% |
| Nightmare | 2.2× | 1.45× | 1.35× | 1.4× | 38,400 | 8% |
| Cataclysm | 3.2× | 1.7× | 1.6× | 1.7× | 48,000 | 12% |

Higher threats also modestly increase enemy movement, projectile speed and firing frequency, while preserving readable windups. Gold-ringed elites have 2.2× hull, 1.2× contact damage and double XP. The existing 210-enemy limit plus the boss is retained. Difficulty values, reward rates and upgrade prices live in `progression.js`; these are initial balance values for playtesting.

## Install and play offline

Serve over HTTPS (or localhost), open the game in Chrome on Android, and choose **Install app** from the browser menu. Installation availability is controlled by the browser. Opening a local file directly does not enable installation or the service worker.

After the first successful online load and service-worker installation, the game can reopen offline. Optional Google Fonts use system fallbacks offline. Relative manifest and worker URLs support both a domain root and GitHub Pages project paths.

When deploying changes to cached files, bump the version in `sw.js`. Close all game windows and reopen to activate the update; an active run is never forcibly reloaded.

## Checks

```sh
node --check game.js
node --check progression.js
node tests/smoke.cjs
node tests/progression.cjs
node tests/runs.cjs 3
```

- **Smoke tests:** 21 regression checks, including closest-enemy targeting, target eligibility, the wider desktop view, swept collisions, pierce ordering, dash immunity, telegraphs, drafts, healing, XP conservation, death/victory, refresh-rate independence, and settings.
- **Progression tests:** 12 checks for save recovery, costs/caps, rewards, unlocks, exactly-once settlement, permanent bonuses, difficulty, boss cores/armor, enemy limits and failed storage writes.
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
