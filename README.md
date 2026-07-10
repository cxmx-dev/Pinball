# Pinball

Vanilla browser pinball prototypes (HTML5 Canvas + Web Audio). No frameworks.

**Play:** https://cxmx-dev.github.io/Pinball/

## Layout

| Folder | What |
|--------|------|
| `index.html` | Hub launcher (Pages root) |
| `pinball v1/` | **NEON NEXUS** — solid physics, audio, tests |
| `pinball v2/` | **VOID PULSE** — v1-class play + layered theme art (Imagine-style packs) |
| `backup/` | Untouched reference snapshot — do not modify |
| `notes/session.md` | Public session log |

## Quick play

- **Live:** https://cxmx-dev.github.io/Pinball/ (launcher → v2 recommended)
- **v2 (current):** open `pinball v2/index.html`
- **v1:** open `pinball v1/index.html`

Each version folder has its own `README.md` for controls and architecture.

## Tests (per version folder)

```bash
node run-tests.js
node verify-browser.js
```

Optional: set env `SCRATCH` to a writable folder for dual-run logs (defaults to OS temp `pinball-scratch`).

Machine-local paths → `USER-NOTES.md` (local only, gitignored).

---

## Version History

**71026 1:41:17:74 PM CST**

- Hub co-locate under `Repos\Pinball`; root launcher + GitHub Pages; scrubbed absolute scratch paths from test/verify scripts (`os.tmpdir()` default). Live: `cxmx-dev/Pinball`.

**71026 12:28:26:70 PM CST**

- Root README added: maps v1 / v2 / backup; points to VOID PULSE as current layered-art table.
