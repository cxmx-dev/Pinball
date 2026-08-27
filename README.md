# Pinball

Vanilla browser pinball prototypes (HTML5 Canvas + Web Audio). No frameworks.

**Play:** https://cxmx-dev.github.io/Pinball/

## Controls

Legend slides from the **right** on **v1** and **v2**. Same features on PC and mobile (keys + dock).

### All devices (parity)

| Action | PC | Mobile / dock |
|--------|-----|----------------|
| **Left flipper** | **←** · **A** · NumPad **1** · left mouse | **L Flip** · left half of table |
| **Right flipper** | **→** · **D** · NumPad **3** · right mouse | **R Flip** · right half of table |
| **Charge / launch** | **Space** hold / release | **Launch** hold / release |
| **Tilt** | NumPad **7** only (3rd drain) | Compact HUD **Tilt** pill (lower score band; scales with table) |
| **Theme** (v2 only) | **T** · left half of split | **Theme \| Legend** (left half) |
| **Open legend** | **L** · right half of split · pad **left analog stick** | **Theme \| Legend** (right) · swipe ← · pad L-stick |
| **Close legend** | **L** · **Esc** · **[X] Close** · pad L-stick | **[X] Close** · **Esc** · pad L-stick |
| **Game over restart** | Spinning pinball · NumPad **7** · pad **any flipper** | **Press here to Restart** · pad any flipper |

**Double-tap charge (v2):** double-tap a flipper to charge **2×** hits for 15s. That bat glows through green / yellow / cyan / orange / blue / white; the pulse starts at 4×/sec and slows as the charge fades. A double-tap on a bat that is already glowing does not re-charge.

**PC theme change:** press **`T`** (or left half of the dock split). Cycles Void Pulse ↔ Ember Rail — art only, same physics. HUD shows the current pack name.

**Tilt is intentionally awkward** (NumPad 7 / HUD pill only — not letter **R**), so it is harder to spam like a real cabinet.


**Gamepad** (Xbox layout in the browser; PlayStation / Switch equivalents in the in-game legend): left flipper **LT · LB · A**; right **RT · RB · B**; plunger **X · Select/View · R3 · right stick down** (hold to charge, release to fire); theme **Y**; tilt **LT+RT+LB+RB**; pause **Start**; legend **left analog stick** (flick any way, same as **L**); game-over restart **any flipper button**. D-pad is reserved for menu navigation.

**Dock layout (PC + mobile):** row 1 = L Flip · Launch · R Flip; row 2 = centered **Theme \| Legend** split (v2) or **Legend** only (v1) — clear of flipper buttons. No top-of-screen key strip (controls live in legend + dock).

**Legend:** roomier vertical spacing; wider drawer on desktop. Phone/tablet legend shows **Action + dock only** (PC hotkeys column hidden).

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`) and **always reserves bottom dock space** (PC + touch) so Theme|Legend stay visible.

## Layout

| Folder | What |
|--------|------|
| `index.html` | Pages root → redirects to **v2** (VOID PULSE) |
| `pinball v1/` | **NEON NEXUS** — solid physics, audio, tests (no theme packs) |
| `pinball v2/` | **VOID PULSE** — v1-class play + layered theme art + cabinet-style flipper/plunger feel |
| `backup/` | Untouched reference snapshot — do not modify |

## Quick play

- **Live:** https://cxmx-dev.github.io/Pinball/ → **VOID PULSE (v2)**
- **v2:** `pinball v2/index.html` or `/pinball%20v2/`
- **v1:** `pinball v1/index.html` or `/pinball%20v1/`

### Local serve

```bash
# from this repo root
npx --yes serve .
```

| Goal | URL |
|------|-----|
| PC | `http://localhost:3000/pinball%20v2/` |
| Phone on same LAN | Network URL from serve → `/pinball%20v2/` |
| Online share | https://cxmx-dev.github.io/Pinball/ |

Open **`/pinball%20v2/`** (trailing slash) or **`/pinball%20v2/index.html`**.

Each version folder has its own `README.md` (controls at top).

## Tests (per version folder)

```bash
node run-tests.js
node verify-browser.js
```

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp).


## Changelog

**2026-08-26** — VOID PULSE table pass (t139): cyan boingers in/up (C 125,708 / B 352,707), right 300 at 343,295, mid 500 at 340,520, horseshoe crown y=18 joining at x=280, rails follow the traces. Cache `?v=opt1`.
**2026-08-26** — VOID PULSE opt1: unlatch L Flip on pointerup/leave/blur, clip so no magenta rect outside the rail, game-over restart hits the visible label/card. Cache `?v=opt1`.
**2026-08-26** - VOID PULSE opt2: unstick horseshoe crown shelf (wider channel, join 280,80), keep opt1 sausage peel / flipper unlatch / magenta clip / restart hit. Cache `?v=opt2`.
