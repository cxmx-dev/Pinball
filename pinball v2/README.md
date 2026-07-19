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

**PC theme:** press **`T`** (or left half of dock split). Cycles Void Pulse ↔ Ember Rail — art only.

**Dock:** L Flip · Launch · R Flip, then centered **Theme \| Legend** split (away from flippers). No top key-hint strip — use legend.

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

**71726 3:37:09:81 AM CST**

- **`update .mds`:** hub push `996a3ab` live path confirmed. Local high scores are browser-only.

**71726 3:33:54:30 AM CST**

- **Table geometry:** rounded top arch (segment ellipse + ride clamp); bumper/kicker rearrange for skill triangle + mid cluster; flipper deck shortened/softened so gray bars no longer block lower toys.

**71726 3:11:39:51 AM CST**

- **P2 polish:** theme flash on pack cycle; Launch dims in play; local high scores + mute + copy score line. Tests: `tests/p2-polish.test.js`.

**71726 2:53:36:86 AM CST**

- **`update .mds`:** **P0 feel** — PC hint auto-hide; combo popup merge; full-lane-dash +800; skill center/near grades + HUD; drain flash + 1× ball-save after skill. Dashes pass-only + reverse cascade; side power meter. Tests: `tests/p0-feel.test.js`.

**71726 1:42:43:19 AM CST**

- **`update .mds`:** root play URL redirects here (v2). PC dock chrome via `device.js` + `game.js` (150). Upper-arch / wireform stuck-ball unstick in `simulation.js`.

**71126 5:03:05:48 AM CST**

- **`update .mds`:** legend airy spacing; mobile legend hides PC hotkeys; controls still **A/D** + NumPad 1/3/7 + Theme\|Legend split.

**71026 10:52:47:33 PM CST**

- **`update .mds`:** left flipper = **A** (not W); **D** right. Docs + legend match `KeyA` / `KeyD` + NumPad 1/3.

**71026 10:48:39:70 PM CST**

- **`update .mds`:** controls/UI docs match live build — Tilt `6.9%` compact pill; Theme\|Legend split; no top KEYS bar; NumPad map + legend parity.

**71026 10:26:43:78 PM CST**

- HUD Tilt in score band (scaled %); **Theme \| Legend** split dock under Launch; canvas HUD clears center for Tilt; later: lower/smaller Tilt + remove top keys hint.

**71026 10:10:54:56 PM CST**

- Controls: tilt **NumPad 7** only; flippers **←→ / A D / Num 1·3**; HUD Tilt pill; dock without Tilt; legend + in-game table updated.

**71026 5:12:45:50 PM CST**

- **`update .mds`:** Controls table = PC/Mobile parity; **T** / Theme for packs; legend matches game.

**71026 4:51:26:83 PM CST**

- Control parity PC/mobile; dock always on; legend 3-column table; **T** / Theme button for packs.

**71026 4:47:52:30 PM CST**

- **`update .mds`:** launch meter holds at max; upper-left stuck-ball geometry/unstick; local serve trailing-slash + offline notes.

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
