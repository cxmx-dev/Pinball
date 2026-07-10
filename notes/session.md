# Pinball — session notes

Public summary of work. Machine paths and capture folders: `USER-NOTES.md` at project root (gitignored).

## Latest focus

**pinball v2 / VOID PULSE** — playable table with agent-generated (Imagine-style) art layers on top of v1 physics.

### Shipped (Phases 0–6)

0. Copy v1 stack into `pinball v2/`  
1. Playfield still under actors (`assets.js` + renderer)  
2. Bumper idle / hit sprites from hit state  
3. Multi-frame spark sheet on flipper + bumper hits  
4. Ambient glow frame underlay (optional video path reserved)  
5. Dual themes: Void Pulse + Ember Rail; **T** swaps art only  
6. Identity polish (HUD accent, title plate, spark-paired SFX)

### Bugfix (same session)

- `safeDrawImage` 6-arg dest form was incorrectly routed to 9-arg `drawImage` → playfield/ambient never blitted. Fixed + arity tests.

### Play validation

Long capture session showed multi-mode HUD (skill shot, jackpot, high combos), correct flipper geometry, and six-figure scores. Table reads finished on full-screen recording.

### Docs

- `pinball v2/README.md` — full public docs  
- Root `README.md` — folder map + play link  
- `USER-NOTES.md` — local-only paths  

### Hub / GitHub

- Dropped into hub `Repos\Pinball` (retired off-hub root).  
- Static Pages: root `index.html` launcher → v1 / v2.  
- OPSEC: test/verify scratch defaults use `os.tmpdir()/pinball-scratch` (no profile paths).  
- Live: https://github.com/cxmx-dev/Pinball · https://cxmx-dev.github.io/Pinball/
- Device-aware: `device.js`, CSS-fit table, touch half-flippers + on-screen Launch/Tilt.  
- Batch push: hub `.\scripts\start-all.ps1` (Pinball uses `-NoPreview`).

### Legend + mobile (71026 PM)

- Right **slide-drawer legend** (VOID PULSE cyan/magenta · NEON purple).  
- Toggle **L**; mobile **fast swipe right-to-left**; **[X] Close** bottom-left.  
- Mobile dock: L Flip · Launch · R Flip · Tilt · Theme (v2) + **`#00ff00`** swipe hint.  
- Public READMEs: **Controls at top**.

---

## Version History

**71026 3:30:07:67 PM CST** — legend drawer + mobile scheme + controls-first docs.

**71026 2:49:40:70 PM CST** — `update .mds`: device-aware + start-all documented.

**71026 1:41:17:74 PM CST** — hub co-locate + first Pages deploy wiring; portable SCRATCH defaults.

**71026 12:28:26:70 PM CST** — session notes written for v2 ship + safeDrawImage fix + play validation.
