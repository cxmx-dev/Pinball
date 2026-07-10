# VOID PULSE Pinball (v2)

Browser pinball with **v1-class physics** dressed in layered agent-generated (Imagine-style) art packs. No frameworks, no build step — open `index.html` and play.

## What This Is

A playable vertical pinball table: gravity, flippers, charge launch, scoring modes, tilt, and procedural audio — plus a **theme asset layer** (playfield still, bumper hit sprites, multi-frame spark VFX, ambient glow frames). Physics never depends on art loading; missing images fail soft and procedural draw still runs.

**Table identity:** **Void Pulse** (default) — cyan / magenta cyber rail. Alternate pack: **Ember Rail** (molten copper). Press **T** to cycle packs.

## Controls

| Input | Action |
|--------|--------|
| **← / →** | Flippers |
| **Left click / tap** | Left flipper |
| **Right click** | Right flipper |
| **Space** (hold / release) | Charge / launch plunger |
| **R** (in play) | Tilt / nudge (2 warnings, 3rd loses ball) |
| **R** (game over) | Restart |
| **T** | Cycle theme pack (art only; same physics) |
| **Touch** | Tap left / right half of table (or on-screen Left/Right); hold **Launch**; **Tilt / R**; long-press Tilt ≈ **T** theme |

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`).

## Quick start

1. Open `index.html` in Chrome, Edge, Firefox, or Safari.
2. Hold **Space** to charge; release to launch up the shooter lane into the wireform.
3. Optional: regenerate theme PNGs with `node scripts/generate-assets.js`.

### Tests

```bash
node run-tests.js
node verify-browser.js
```

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp `pinball-scratch`; machine habits → root `USER-NOTES.md` if present).

## Architecture

| File | Role |
|------|------|
| `simulation.js` | Pure physics / scoring (no DOM, no images) |
| `assets.js` | Theme packs, hit→VFX hooks, `safeDrawImage` overloads |
| `renderer.js` | Layered canvas draw order |
| `audio.js` | Procedural Web Audio (bumper / flipper spark pairing) |
| `game.js` | Input + loop + theme key |
| `index.html` | Entry — plain `<script src>` for `file://` |
| `scripts/generate-assets.js` | Procedural PNG theme generator (no heavy deps) |
| `tests/assets-vfx.test.js` | Theme swap physics identity + VFX + draw arity |

### Script load order

`simulation.js` → `assets.js` → `renderer.js` → `audio.js` → `game.js`

### Draw stack

1. Cabinet + theme title plate  
2. Playfield still + optional ambient frames / video underlay  
3. Rails, slings, targets, bumper sprites, kickers  
4. Spark multi-frame bursts (flipper + bumper contact)  
5. Flippers, ball, plunger  
6. HUD / power meter  

### `safeDrawImage` call forms

After `(ctx, img)`:

| Args | Maps to |
|------|---------|
| `x, y` | `drawImage(img, x, y)` |
| `dx, dy, dw, dh` | `drawImage(img, dx, dy, dw, dh)` — playfield still + ambient |
| `sx, sy, sw, sh, dx, dy, dw, dh` | full source + dest — bumper / spark sheets |

Incomplete or broken images (`!complete` or `naturalWidth === 0`) never call `drawImage`.

## Theme packs

- `assets/themes/void-pulse/` — default  
- `assets/themes/ember-rail/` — alternate  
- `assets/themes.json` — pack index  

Each pack: `manifest.json`, playfield `base.png`, ambient frames, bumper `idle` / `hit`, spark sprite sheet.

## What’s preserved from v1

Gravity, flippers, charge launch, wireform, bumpers, slings, targets, rollovers, spinner, kickers, skill shot, jackpot, combo multiplier, tilt, three drain zones, procedural audio, unit + Monte Carlo + browser-load verification.

## Play validation (session)

Long play sessions reach multi-mode HUD states (skill shot, jackpot lit, high combos, six-figure scores). Flipper geometry and launch path read correctly on screen capture; table identity (VOID PULSE) is visible on the cabinet plate.

Machine-local capture paths: see `USER-NOTES.md` (not published).

---

## Version History

**71026 1:41:17:74 PM CST**

- Portable `SCRATCH` default (`os.tmpdir()/pinball-scratch`) in test/verify scripts for public repo hygiene.

**71026 12:28:26:70 PM CST**

- Doc sync (`update .mds`): README reflects Phases 0–6 ship, `safeDrawImage` overloads, tests, theme packs, and play validation notes.
- Fixed playfield/ambient blit: 6-arg dest form maps to 5-arg `drawImage` (not broken 9-arg with `undefined`).
- Honest arity tests in `tests/assets-vfx.test.js` for dest-size + `drawPlayfieldLayer`.

**71026 (session) CST**

- Shipped **pinball v2** Phases 0–6: v1 fork, playfield still, bumper hit sprites, spark sheets, ambient underlay, dual theme packs, Void Pulse identity polish.
- Added `assets.js`, `scripts/generate-assets.js`, `tests/assets-vfx.test.js`.
- Spark-paired SFX on bumper / flipper hits; **T** theme cycle without physics drift.
