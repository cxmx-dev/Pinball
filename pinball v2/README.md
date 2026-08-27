# VOID PULSE Pinball (v2)

Browser pinball with **v1-class physics** dressed in layered agent-generated (Imagine-style) art packs. No frameworks, no build step — open `index.html` and play.

## Controls

In-game **legend** slides from the **right** (**L**, **Legend** button, or swipe ← on touch). **[X] Close** bottom-left. **Dock is on PC and mobile.**

| Action | PC | Mobile / dock |
|--------|-----|----------------|
| Left flipper | **←** · **A** · NumPad **1** · LMB | **L Flip** · left table half |
| Right flipper | **→** · **D** · NumPad **3** · RMB | **R Flip** · right table half |
| Charge / launch | **Space** hold / release | **Launch** hold / release |
| Tilt | NumPad **7** only | Compact HUD **Tilt** (lower score band) |
| **Theme** | **T** · split left | **Theme \| Legend** (left) |
| Legend | **L** · split right | **Theme \| Legend** (right) · swipe ← |
| Close legend | **L** · **Esc** · **[X]** | **[X]** · **Esc** |
| Game over | Spinning pinball · NumPad **7** | **Press here to Restart** · spin pinball |

**Double-tap charge:** double-tap a flipper to charge **2×** hits for 15s. That bat glows through green / yellow / cyan / orange / blue / white; the pulse starts at 4×/sec and slows as the charge fades. A double-tap on a bat that is already glowing does not re-charge. A double-tap on a bat that is already glowing does not re-charge.

**PC theme:** press **`T`** (or left half of dock split). Cycles Void Pulse ↔ Ember Rail — art only.


**Gamepad** (Xbox layout in the browser; PlayStation / Switch equivalents in the in-game legend): left flipper **LT · LB · A**; right **RT · RB · B**; plunger **X · Select/View · R3 · right stick down** (hold to charge, release to fire); theme **Y**; tilt **LT+RT+LB+RB**; pause **Start**; legend **left analog stick** (flick any way, same as **L**); game-over restart **any flipper button**. D-pad is reserved for menu navigation.

**Dock:** L Flip · Launch · R Flip, then centered **Theme \| Legend** split (away from flippers). No top key-hint strip — use legend.

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`). Phones use a lighter quality tier (simpler rail draw, capped upscale) so play stays smooth; desktop keeps full effects.

## What This Is

The **spinner** sits under the left arch and visually spins when hit.

A playable vertical pinball table: gravity, flippers, charge launch, scoring modes, tilt, and procedural audio — plus a **theme asset layer** (playfield still, bumper hit sprites, multi-frame spark VFX, ambient glow frames). Physics never depends on art loading; missing images fail soft and procedural draw still runs. Physics includes sweep-gated tip-weighted flippers, soft speed limiting, incident-scaled sling kicks, and an eased plunger charge curve.

**Table identity:** **Void Pulse** (default) — cyan / magenta cyber rail. Alternate pack: **Ember Rail** (molten copper).

## Quick start

1. Open `index.html` in Chrome, Edge, Firefox, or Safari.
2. Hold **Space** (or **Launch**) to charge; release to launch.
3. Optional: regenerate theme PNGs with `node scripts/generate-assets.js`.

### Tests

```bash
node run-tests.js
node verify-browser.js
```

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp).

## Architecture

| File | Role |
|------|------|
| `simulation.js` | Pure physics / scoring (no DOM, no images) |
| `assets.js` | Theme packs, hit→VFX hooks, `safeDrawImage` overloads |
| `renderer.js` | Layered canvas draw order |
| `audio.js` | Procedural Web Audio (bumper / flipper spark pairing) |
| `game.js` | Input, legend drawer, loop, theme key |
| `index.html` | Entry + legend UI + touch dock |
| `scripts/generate-assets.js` | Procedural PNG theme generator |
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

## Theme packs

- `assets/themes/void-pulse/` — default
- `assets/themes/ember-rail/` — alternate
- `assets/themes.json` — pack index

## What's preserved from v1

Gravity, flippers, charge launch, wireform, bumpers, slings, targets, rollovers, spinner, kickers, skill shot, jackpot, combo multiplier, tilt, three drain zones, procedural audio, unit + Monte Carlo + browser-load verification.

## Changelog

**2026-08-26** — VOID PULSE table pass (t139): cyan boingers in/up (C 125,708 / B 352,707), right 300 at 343,295, mid 500 at 340,520, horseshoe crown y=18 joining at x=280, cache \?v=lay2\.
