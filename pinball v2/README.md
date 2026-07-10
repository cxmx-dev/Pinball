# VOID PULSE Pinball (v2)

Browser pinball with **v1-class physics** dressed in layered agent-generated (Imagine-style) art packs. No frameworks, no build step — open `index.html` and play.

## Controls

In-game **legend** slides from the **right**: press **L**, or on mobile **swipe right to left fast**. **[X] Close** sits bottom-left of the drawer.

### Desktop

| Input | Action |
|--------|--------|
| **← / →** | Flippers |
| **Left click / Right click** | Left / right flipper |
| **Space** hold / release | Charge / launch plunger |
| **R** (in play) | Tilt / nudge (2 warnings, 3rd loses ball) |
| **R** (game over) | Restart |
| **T** | Cycle theme pack (art only; same physics) |
| **L** | Toggle controls legend |
| **Esc** | Close legend |

### Mobile / touch (best scheme)

| Control | Action |
|--------|--------|
| **L Flip / R Flip** | Hold bottom dock pads |
| **Table half** | Hold left or right side of the table |
| **Launch** | Hold to charge · release to fire |
| **Tilt** | Nudge · restart on game over |
| **Theme** | Cycle Void Pulse / Ember Rail (dedicated button) |
| **Swipe right → left fast** | Open legend drawer from the right |
| Green **`#00ff00`** line under dock | *swipe right to left fast to see the legend* |
| **[X] Close** | Bottom-left of legend |
| **Game over** | **Press here to Restart** — tap the **spinning / shining pinball** (required on mobile) |

Desktop game over: **R** to play again. Mobile: press the animated pinball (not R-only).

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`).

## What This Is

A playable vertical pinball table: gravity, flippers, charge launch, scoring modes, tilt, and procedural audio — plus a **theme asset layer** (playfield still, bumper hit sprites, multi-frame spark VFX, ambient glow frames). Physics never depends on art loading; missing images fail soft and procedural draw still runs.

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

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp `pinball-scratch`; machine habits → root `USER-NOTES.md` if present).

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

## What’s preserved from v1

Gravity, flippers, charge launch, wireform, bumpers, slings, targets, rollovers, spinner, kickers, skill shot, jackpot, combo multiplier, tilt, three drain zones, procedural audio, unit + Monte Carlo + browser-load verification.

Machine-local capture paths: see `USER-NOTES.md` (not published).

---

## Version History

**71026 3:45:44:35 PM CST**

- **`update .mds`:** Controls-first README complete (desktop + mobile legend + game-over pinball restart).

**71026 3:43:05:78 PM CST**

- Mobile game over: **Press here to Restart** with spinning/shining pinball control.

**71026 3:30:07:67 PM CST**

- Right-side **legend slide-drawer** (**L**, swipe RTL, **[X] Close**). Mobile dock: L/R Flip, Launch, Tilt, Theme + green swipe hint. Controls section at top of README.

**71026 2:49:40:70 PM CST**

- `update .mds`: device-aware touch/desktop controls documented; hub batch via `start-all.ps1`.

**71026 1:41:17:74 PM CST**

- Portable `SCRATCH` default (`os.tmpdir()/pinball-scratch`) in test/verify scripts for public repo hygiene.

**71026 12:28:26:70 PM CST**

- Doc sync: Phases 0–6 ship, `safeDrawImage` overloads, tests, theme packs, play validation notes.
