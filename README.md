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
| **Open legend** | **L** · right half of split | **Theme \| Legend** (right) · swipe ← |
| **Close legend** | **L** · **Esc** · **[X] Close** | **[X] Close** · **Esc** |
| **Game over restart** | Spinning pinball · NumPad **7** | **Press here to Restart** · spin pinball |

**PC theme change:** press **`T`** (or left half of the dock split). Cycles Void Pulse ↔ Ember Rail — art only, same physics. HUD shows the current pack name.

**Tilt is intentionally awkward** (NumPad 7 / HUD pill only — not letter **R**), so it is harder to spam like a real cabinet.

**Dock layout (PC + mobile):** row 1 = L Flip · Launch · R Flip; row 2 = centered **Theme \| Legend** split (v2) or **Legend** only (v1) — clear of flipper buttons. No top-of-screen key strip (controls live in legend + dock).

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`).

## Layout

| Folder | What |
|--------|------|
| `index.html` | Hub launcher (Pages root) |
| `pinball v1/` | **NEON NEXUS** — solid physics, audio, tests (no theme packs) |
| `pinball v2/` | **VOID PULSE** — v1-class play + layered theme art |
| `backup/` | Untouched reference snapshot — do not modify |
| `notes/session.md` | Public session log |

## Quick play

- **Live (share this):** https://cxmx-dev.github.io/Pinball/ (launcher → v2 recommended)
- **v2 (current):** open `pinball v2/index.html` or serve path `/pinball%20v2/`
- **v1:** open `pinball v1/index.html` or `/pinball%20v1/`

### Local serve (dev / phone on same Wi‑Fi / **internet out**)

**Yes — you can play with no GitHub and no internet**, as long as Node + `serve` are already on the PC (after a prior `npx` install, the package stays cached).

```bash
# from this repo root only — not the hub parent folder
npx --yes serve .
```

| Goal | Do this |
|------|---------|
| PC only | `http://localhost:3000/pinball%20v2/` |
| Phone on same LAN | Network URL serve prints → `http://192.168.x.x:3000/pinball%20v2/` |
| Internet / GitHub down | Same local serve — **no** github.io needed |
| Friends anytime online | https://cxmx-dev.github.io/Pinball/ (no `serve`) |

Open **`/pinball%20v2/`** (trailing slash) or **`/pinball%20v2/index.html`**.  
Without the slash/`index.html`, browsers load scripts from the wrong folder and the table stays blank (404).

Leave the terminal running while you play. Phone LAN needs Private Wi‑Fi + firewall once (`allow-lan-preview.ps1` on this machine — local only).

**Push after Grok edits** (needs internet): hub `.\scripts\start.ps1 -Repo Pinball` — not required for local play.

Each version folder has its own `README.md` (controls at top).

## Tests (per version folder)

```bash
node run-tests.js
node verify-browser.js
```

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp `pinball-scratch`).

Machine-local paths → `USER-NOTES.md` (local only, gitignored).

---

## Version History

**71026 10:52:47:33 PM CST**

- **`update .mds`:** left flipper letter key is **A** (not W) with **D** right — code, in-game legend, and all public/User docs synced. Full map: **← / A / NumPad 1** · **→ / D / NumPad 3** · tilt **NumPad 7** · HUD Tilt + Theme\|Legend dock.

**71026 10:48:39:70 PM CST**

- **`update .mds`:** full control/UI sync — NumPad flipper/tilt map; HUD **Tilt** compact at `top: 6.9%` (clears score text); **Theme \| Legend** split dock; **no top KEYS strip** (PC + mobile); legend/READMEs/USER-NOTES match live game.

**71026 10:26:43:78 PM CST**

- **UI:** HUD **Tilt** in score band; canvas HUD clears center for it. Dock: **Theme \| Legend** split under Launch (clear of L/R Flip). Later polish: Tilt lower/`6.9%` + smaller; remove top keys hint.

**71026 10:10:54:56 PM CST**

- **Controls remap (v1 + v2):** tilt = **NumPad 7** only (no **R**); left flipper = **← / A / NumPad 1**; right = **→ / D / NumPad 3**; HUD **Tilt** pill top-center on table (out of dock); legend + READMEs synced. Ready to revert via `USER-NOTES.md` prior bindings.

**71026 5:12:45:50 PM CST**

- **`update .mds`:** PC/mobile **control parity** documented end-to-end — dock on both; legend Action/PC/Mobile matches game; **PC theme = T** or Theme button; game-over spinning pinball both devices.

**71026 4:51:26:83 PM CST**

- PC + mobile **control parity**: dock always visible (Theme / Legend on PC); legend is a 3-column Action / PC / Mobile table; game-over pinball on both devices. **PC theme = T or Theme button.**

**71026 4:47:52:30 PM CST**

- **`update .mds`:** physics/ops notes — launch meter **holds at max**; upper-left **stuck ball** wedge opened + corner unstick; trailing-slash serve fix; LAN firewall helper local-only; pushes on `main`.

**71026 4:42:24:18 PM CST**

- **`update .mds`:** documented **offline / internet-out local play** (`npx serve` from repo root, no GitHub required); LAN phone vs github.io summary; push habit separate from local host.

**71026 3:45:44:35 PM CST**

- **`update .mds`:** full public control docs synced — legend drawer, mobile dock, green swipe hint, game-over spinning pinball restart; **Controls always first** on root + v1 + v2 READMEs.

**71026 3:43:05:78 PM CST**

- Mobile **game over**: **Press here to Restart** + animated spinning/shining pinball button (must press). Desktop still uses **R**.

**71026 3:30:07:67 PM CST**

- Legend slide-drawer from right (**L** toggle; mobile fast swipe right-to-left; **[X] Close** bottom-left). Mobile dock scheme + green `#00ff00` swipe hint. Controls documented at top of public READMEs.

**71026 2:49:40:70 PM CST**

- `update .mds`: device-aware (scale-to-fit + touch flippers/UI); hub **`start-all.ps1`** / `-NoPreview` for batch push without local serve.

**71026 1:41:17:74 PM CST**

- Hub co-locate under `Repos\Pinball`; root launcher + GitHub Pages; scrubbed absolute scratch paths from test/verify scripts (`os.tmpdir()` default). Live: `cxmx-dev/Pinball`.

**71026 12:28:26:70 PM CST**

- Root README added: maps v1 / v2 / backup; points to VOID PULSE as current layered-art table.
