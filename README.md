# Pinball

Vanilla browser pinball prototypes (HTML5 Canvas + Web Audio). No frameworks.

**Play:** https://cxmx-dev.github.io/Pinball/

## Controls

Legend drawer slides in from the **right** on **v1** and **v2**.

| Input | Action |
|--------|--------|
| **← / →** | Left / right flipper |
| **LMB / RMB** | Left / right flipper |
| **Space** hold / release | Charge / launch plunger |
| **R** | Tilt (3rd loses ball) · restart on game over |
| **T** | Cycle theme (**v2 only** — art only) |
| **L** | Toggle controls legend (slide-drawer) |
| **Esc** | Close legend (when open) |

### Mobile / touch (recommended scheme)

| Control | Action |
|--------|--------|
| **L Flip / R Flip** | Hold pads (bottom dock) |
| **Table half** | Tap/hold left or right side of playfield |
| **Launch** | Hold to charge · release to fire |
| **Tilt** | Nudge · restart on game over |
| **Theme** | Cycle packs (**v2 only**) |
| **Swipe right → left fast** | Open legend from the right |
| **`#00ff00` dock hint** | Reminds you to swipe for legend |
| **[X] Close** | Bottom-left of legend drawer |
| **Game over** | **Press here to Restart** — tap the **spinning / shining pinball** (mobile) |

Audio unlocks on first key, click, or touch. Layout auto-fits phone / tablet / desktop (`device.js`).

## Layout

| Folder | What |
|--------|------|
| `index.html` | Hub launcher (Pages root) |
| `pinball v1/` | **NEON NEXUS** — solid physics, audio, tests |
| `pinball v2/` | **VOID PULSE** — v1-class play + layered theme art |
| `backup/` | Untouched reference snapshot — do not modify |
| `notes/session.md` | Public session log |

## Quick play

- **Live (share this):** https://cxmx-dev.github.io/Pinball/ (launcher → v2 recommended)
- **v2 (current):** open `pinball v2/index.html` or serve path `/pinball%20v2/`
- **v1:** open `pinball v1/index.html` or `/pinball%20v1/`

### Local serve (dev / phone on same Wi‑Fi)

```bash
# from this repo root only — not the hub parent folder
npx --yes serve .
```

Open **`/pinball%20v2/`** (trailing slash) or **`/pinball%20v2/index.html`**.  
Without the slash/`index.html`, browsers load scripts from the wrong folder and the table stays blank (404).

Phone: use the **Network** URL `serve` prints (e.g. `http://192.168.x.x:3000/pinball%20v2/`), PC and phone on the same Wi‑Fi, leave serve running.

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
