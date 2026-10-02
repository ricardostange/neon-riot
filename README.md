# NEON RIOT

## [▶ Play NEON RIOT in your browser](https://ricardostange.github.io/neon-riot/)

Free to play on PC and mobile — no download required.

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

Touch screens get an analog movement stick, dash button and a compact pause button above dash. Desktop pause remains at the top right. Menus support keyboard navigation. The game pauses when you switch tabs or lose window focus.

## Same short run. Sharper chaos.

**The boss still arrives at 03:00.** Finish the fight, bank Scrap, improve your ship and choose a higher threat for the next run.

- Weapons automatically target the closest eligible enemy and lead moving targets. No mouse aiming or clicking required.
- Desktop uses the original camera scale (1:1 on normal and large windows, scaling down on small windows). Touch keeps its 720-unit short-axis view. Camera size does not affect spawn distances, targeting, XP collection or enemy attack eligibility.
- Dash hits the whole path, not just your landing point. Dash kills refund up to 0.8 seconds of cooldown per dash.
- Green shards level you up. Pink crosses repair hull and remain on the ground while you're at full health.
- Upgrade effects stack. Cards show exact before/after stats, ranks, and build matches. Every draft includes an offensive option.
- Shooters lock their aim during visible windups. The boss has 144,000 hull on Street and three cores. Each destroyed core triggers 1.5 seconds of visible armor and a telegraphed counterattack; damage cannot skip cores. Later cores fire denser rings and wider fans, move faster and attack more often.
- Shockwaves knock enemies back and erase projectiles. All loose XP is pulled toward you when the boss arrives.
- The results screen breaks down damage by weapon, level reached, and dash kills.
- Sound and **FX CALM** preferences save locally, alongside your best elimination count. Calm mode reduces particles and disables screen shake, hit flashes, and decorative animation; attack warnings remain visible. It defaults on for reduced-motion system preferences.

Try multishot + piercing, orbiting blades + speed, or shockwaves + a giant pickup radius.

**Blade Aegis** replaces the old Personal space upgrade (the internal upgrade ID remains `orbit`). Each rank adds a larger shield-blade and +15% base damage to all blades after the first rank. Base damage is 42 instead of 22, with time scaling capped at boss arrival. At 03:00, each blade deals 105 damage at rank 1 or 168 at rank 5. Each blade has its own 0.3-second repeat-hit cooldown per enemy, so extra blades contribute independently.

Blades intercept ordinary and boss projectiles on contact, using swept collision checks that account for player/blade movement. Interception must occur before the projectile hits the hull; gaps between blades remain vulnerable. Cyan impact flashes show successful blocks. Orbit radius is 90 and rotation speed is 4.2 radians/second.

Everything works offline. Optional Google Fonts fall back to system fonts. The server binds only to localhost.

## XP, final-minute packs and boss positioning

The boss still arrives at 03:00 and all in-run upgrade effects, percentages and rank caps remain unchanged. XP requirements are 1.5× the original threshold at each level, rounded up: 12, 20, 29, 39, 51… The original base sequence still grows by `floor(base * 1.17 + 4)`; the multiplier is applied afterward so it does not compound. Surplus XP carries over.

The director maintains a weighted budget of living enemies, including enemies arriving under spawn protection. Killing enemies frees budget for replacements on the next 0.75-second refill pulse; stronger builds can earn XP faster. The budget depends only on elapsed time and the selected difficulty, never on player damage, level or Workshop ranks.

| Elapsed time | Street threat budget |
| --- | --- |
| 00:00 | 8 |
| 00:30 | 16 |
| 01:00 | 30 |
| 01:30 | 46 |
| 02:00 | 64 |
| 02:30 | 86 |
| 03:00, before boss reduction | 108 |
| Boss fight | 43 |

Budget interpolates between these points, multiplies by difficulty density and rounds down. Boss arrival reduces the swarm budget to 40% of the final budget; existing enemies are not deleted, and replacements wait until enough budget is free. The boss is accounted for separately and still arrives exactly at 03:00. The 210 ordinary-enemy cap remains a final safety limit.

| Enemy | Threat cost | XP |
| --- | --- | --- |
| Chaser / weak chaser | 1 | 1 |
| Runner | 2 | 2 |
| Shooter | 3 | 3 |
| Tank | 4 | 5 |
| Elite | Base cost × 2 | Base XP × 2 |

Existing XP rewards are retained: the tank's modest XP premium compensates for its durability. Tanks may occupy at most 35% of budget, shooters 25%, and all enemies other than non-elite chasers together 60%. If a rolled enemy cannot fit, an ordinary chaser fills the gap. Unlock times remain 12 seconds for runners, 30 for tanks and 55 for shooters; difficulty elite rolls begin at 35 seconds.

From 02:00, an elite tank and eight weak chasers are requested no more often than every 12 seconds. They spend available budget instead of adding an extra stream of enemies. The tank waits for both budget and tank capacity; weak chasers fill subsequent available slots. These opportunities stop at boss arrival. Weak chasers retain 22 hull before difficulty scaling, half contact damage and one XP; they cannot roll elite modifiers.

Ordinary enemies arrive on a fixed 560-unit ring around the player with an 0.85-second protected arrival warning. Targeting range is 460 units, independent of visibility; ranged enemies can initiate windups only within 340 units. Enemies more than 1,000 units away recycle to the arrival ring with renewed protection. The boss arrives at a fixed offset of (180, −210). Pickup radius and movement speeds remain unchanged. Window size and rotation affect rendering only, although different aspect ratios still reveal different amounts of scenery.

The boss retains three times its original hull and the same directional vulnerability. Eight steel-colored armor plates cover the blocked 240 degrees; shoot through the bare 120-degree gap. The opening stays fixed for seven active seconds, then shifts 90 degrees. A thin dashed preview shows the next armor position for the final 1.5 seconds. Core-transition armor closes the whole circle for 1.5 seconds and pauses the direction timer. Shots use incoming trajectory, blades use contact position, and dash/shockwave use attack origin.

Blocked hits briefly brighten the armor and show a small BLOCK label at most once every 0.7 seconds. Successful hits display actual hull damage beside the boss, aggregating hits in 0.2-second windows to limit clutter. No damage numbers are added to ordinary enemies. Calm mode suppresses the armor flash but retains readable text and warnings.

Dash recharge plays a distinct two-note rising cue, expands a short mint ring and briefly shows DASH READY below the ship. The notification fires once per cooldown completion and remains readable with sound muted.

Player bullets and their impact sparks stay cyan/white, distinct from pink/orange hostile projectiles. Higher bullet damage makes rounds thicker and brighter, with a capped trail/impact increase and a heavier firing tone. Fire-rate upgrades change the sound cadence/timbre; shockwave ranks thicken the existing blast ring. These are presentation changes, not extra weapon damage, hitboxes or projectile counts. Enemy shots remain drawn above effects; sound rate limits, calm mode and the particle cap remain in place.

## Minimal combat HUD

Combat shows the timer, hull, dash cooldown, XP/level, Pause and a compact boss bar. Sound, effects and fullscreen buttons are inside Pause. Difficulty, eliminations and the current build remain available in Pause.

Hull and dash recharge occupy matching bars at the lower left and lower right, below the movement and dash controls respectively. The XP bar and centered level label sit beneath both, leaving the middle of the arena clear.

No branding, objective text, live kill/chain counters, loadout tiles, ordinary-enemy damage numbers, dash-refund text or large combat announcements cover the arena. Damage/healing feedback, enemy telegraphs, boss armor and elite outlines remain visible. The timer turns pink in the ten seconds before the boss arrives. Health pickup frequency is reduced to a 0.6% random chance per ordinary enemy kill, with a low-health fallback every 140 kills. Touch controls sit closer to the bottom edge, with the same target sizes and movement behavior.

## Scrap and the workshop

Completed runs award full Scrap on victory. Defeat keeps 50% of the run reward (a 50% penalty), both before and during the boss fight; already-banked Scrap is never deducted. Rewards are saved immediately when the run ends. Closing or reloading an unfinished standard run does not award Scrap; Endless banks each completed minute separately.

`Scrap = floor((survival + eliminations + victory) × threat multiplier × (victory ? 1 : 0.5))`

- Survival: 1 Scrap per 6 seconds, capped at 30.
- Eliminations: 1 Scrap per 10 kills, capped at 50.
- Victory: 60 additional Scrap.

A Street victory with at least 500 eliminations earns 140 Scrap. Survival and elimination rewards stop growing after their caps, so keeping the boss alive cannot generate unlimited rewards. Use **Workshop** from the menu or **Spend Scrap** on the result screen.

| Run outcome | Street | Overdrive | Nightmare | Cataclysm |
| --- | --- | --- | --- | --- |
| Defeat at 00:30, 50 kills | 5 | 7 | 11 | 16 |
| Defeat at 01:00, 100 kills | 10 | 15 | 22 | 32 |
| Defeat at 02:00, 250 kills | 22 | 33 | 49 | 70 |
| Defeat at/after 03:00, 500+ kills (maximum loss reward) | 40 | 60 | 88 | 128 |
| Boss defeated, 300 kills | 120 | 180 | 264 | 384 |
| Boss defeated, 500+ kills (maximum win reward) | 140 | 210 | 308 | 448 |
| Full defeat payout range | 0–40 | 0–60 | 0–88 | 0–128 |
| Victory payout bounds (boss arrives at 03:00) | 90–140 | 135–210 | 198–308 | 288–448 |

The formula above determines every payout; the time/kill pairs are examples, not a fixed relationship. Fractional Scrap is rounded down once, at the end. Dying during the boss fight still counts as defeat. Victory bounds include a theoretical minimum with fewer than 10 total kills; actual wins usually include substantially more kills. Quitting/reloading before the run ends earns nothing.

| Permanent upgrade | Each rank | Maximum ranks | Rank costs |
| --- | --- | --- | --- |
| Reinforced hull | +10 starting/max hull | 10 | 30, 50, 80, 120, 175, 240, 320, 415, 525, 650 |
| Hotter rounds | +6% starting bullet damage | 10 | 40, 70, 110, 170, 250, 350, 475, 625, 800, 1000 |
| Rapid cycling | +8% starting attack speed | 10 | 40, 70, 110, 170, 250, 350, 475, 625, 800, 1000 |
| Salvage field | +10% starting pickup radius | 10 | 15, 25, 40, 60, 85, 115, 150, 190, 235, 285 |
| Dash capacitor | −4% starting dash cooldown | 10 | 25, 45, 75, 110, 155, 210, 280, 360, 450, 550 |
| Second opinions | +1 reroll per run | 10 | 45, 85, 140, 210, 300, 410, 540, 690, 860, 1050 |

Ranks add to the starting bonus, then normal run upgrades apply. Rapid cycling reaches +80% starting attack speed, dividing the firing interval by 1.8; it stacks multiplicatively with Trigger happy. Damage reaches +60%. Existing ranks, balances and unlocks are preserved; new prices apply to future purchases with no retroactive deductions or refunds.

Progress is stored in this browser's localStorage, independently of existing sound, effects and personal-best settings. It is not synced across devices; clearing site data erases it. If storage writes fail, the workshop/results display a warning and progress remains usable for the current session.

## Threat levels

Beat the boss on a tier to unlock the next. Unlocked tiers remain freely selectable; **One more run** repeats your selection, while **Change difficulty** returns to the menu.

| Threat | Scrap | Threat budget | Enemy hull | Incoming damage | Boss hull | Elite chance after 00:35 |
| --- | --- | --- | --- | --- | --- | --- |
| Street | 1× | 1× | 1× | 1× | 144,000 | 0% |
| Overdrive | 1.5× | 1.2× | 1.15× | 1.2× | 180,000 | 4% |
| Nightmare | 2.2× | 1.45× | 1.35× | 1.4× | 230,400 | 8% |
| Cataclysm | 3.2× | 1.7× | 1.6× | 1.7× | 288,000 | 12% |

Higher threats also modestly increase enemy movement, projectile speed and firing frequency, while preserving readable windups. Gold-ringed elites have 2.2× hull, 1.2× contact damage and double XP. The existing 210-enemy limit plus the boss is retained. Difficulty values, reward rates and upgrade prices live in `progression.js`; these are initial balance values for playtesting.

## Endless

Beat Cataclysm once to unlock **Endless ∞** in the difficulty selector. Existing saves with a Cataclysm victory unlock it automatically. It uses Cataclysm enemy stats and the same threat curve through 03:00, then grows its weighted enemy budget smoothly by 20% per minute: `floor(108 × 1.7 × 1.2^((seconds − 180) / 60))`.

There is no final boss, boss-phase budget reduction, or ordinary-enemy population cap in Endless. Composition limits and refill timing still apply; elite/weak-pack opportunities continue. Enemy stat time scaling retains its existing limits: continued growth comes from numbers. Very long runs can become slow, by design.

Each completed minute N immediately banks **100 + 20 × N Scrap**, without a difficulty multiplier or kill bonus. Total earned after N minutes is `100N + 10N(N + 1)`. For example:

| Completed minutes | Latest payout | Total banked |
| --- | --- | --- |
| 1 | 120 | 120 |
| 3 | 160 | 420 |
| 5 | 200 | 800 |
| 10 | 300 | 2,100 |
| 20 | 500 | 6,200 |

Death has no penalty in Endless and does not pay the same earnings twice. Closing the game retains completed-minute rewards that were successfully saved; unfinished minutes earn nothing. Pauses and upgrade screens do not advance survival time. The existing 10,000,000 Scrap wallet limit still applies.

XP requirements and normal upgrade bonuses remain unchanged. When no upgrades remain available, each further level automatically repairs 25 hull without opening a draft. No anti-immortality mechanic is added. Desktop zoom, touch controls and ordinary-mode rules remain as before.

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
node tests/blades.cjs
node tests/balance.cjs
node tests/threat.cjs
node tests/feedback.cjs
node tests/endless.cjs
node tests/runs.cjs 3
```

- **Smoke tests:** 21 regression checks, including closest-enemy targeting, target eligibility, restored desktop zoom and retained touch scale, swept collisions, pierce ordering, dash immunity, telegraphs, drafts, healing, XP conservation, death/victory, refresh-rate independence, and settings.
- **Progression tests:** 12 checks for save recovery, costs/caps, rewards, unlocks, exactly-once settlement, permanent bonuses, difficulty, boss cores/armor, enemy limits and failed storage writes.
- **Threat tests:** budget interpolation and difficulty, selective-kill composition limits, weighted refill timing, boss transition, fixed spawn/attack distances, and identical one-minute simulation outcomes across five viewports plus rotation.
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
