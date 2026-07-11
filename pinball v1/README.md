# NEON NEXUS Pinball

Browser pinball built with vanilla JavaScript, HTML5 Canvas, and the Web Audio API. No frameworks, no build step — open `index.html` and play.

> **Successor:** layered Imagine-style theme packs and VOID PULSE identity live in sibling folder `pinball v2/` (same physics baseline, art layers on top).

## Controls

Legend from the **right** (**L**, **Legend** button, or swipe). Dock on **PC and mobile**. No theme packs on NEON NEXUS (see v2 for **T** / Theme).

| Action | PC | Mobile / dock |
|--------|-----|----------------|
| Left flipper | **←** · **W** · NumPad **1** · LMB | **L Flip** · left table half |
| Right flipper | **→** · **D** · NumPad **3** · RMB | **R Flip** · right table half |
| Charge / launch | **Space** hold / release | **Launch** hold / release |
| Tilt | NumPad **7** only | HUD **Tilt** (top score band) |
| Legend | **L** or **Legend** | **Legend** centered under Launch · swipe ← |
| Close legend | **L** · **Esc** · **[X]** | **[X]** · **Esc** |
| Game over | Spinning pinball · NumPad **7** | **Press here to Restart** |

Audio unlocks on the first key, click, or touch.

## Quick Start

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
2. Press an arrow key or click once to enable sound.
3. Hold **Space** to charge, release to launch toward the top wireform and bumpers.

### Run tests (optional)

```bash
node run-tests.js
node verify-browser.js
```

## Tech Stack

- **JavaScript** — game loop, input, modular architecture
- **HTML5 Canvas 2D** — rendering, particles, HUD
- **Web Audio API** — procedural pinball SFX (no audio files)
- **CSS** — cabinet layout and typography ([Orbitron](https://fonts.google.com/specimen/Orbitron))
- **Node.js** — unit tests, Monte Carlo drain checks, browser-load verification

| File | Role |
|------|------|
| `simulation.js` | Pure physics and game logic |
| `renderer.js` | Canvas drawing and effects |
| `audio.js` | Sound synthesis and event playback |
| `game.js` | Input, loop, browser bootstrap |
| `index.html` | Entry point |

## What’s In The Table

- Top wireform launch rail (shooter lane → curl left → top bumpers)
- Bumpers, slingshots, standup targets, rollovers, kickers, spinner
- Skill shot, jackpot, combo multiplier, bonus bank
- Three drain zones (left outlane, center, right outlane)
- Outlane saver bumper and invisible lane guides
- Tilt warnings, procedural sound for each hit type

---

## 50 Things We Can Still Add

1. Multiball mode (2–4 balls at once)
2. Ball save / post between flippers
3. Extra ball award sequence
4. High score table (localStorage)
5. Online leaderboard API
6. Player initials entry (classic 3-letter grid)
7. Attract mode demo with AI flipper bot
8. Nudge on mouse shake / device accelerometer
9. Cabinet art skins (tables themes: cyber, retro, horror)
10. Animated backglass with scrolling score reels
11. Dot-matrix display simulation for match / replay
12. Match last two digits at game over
13. Replay free game on lucky match
14. Ball lock / multiball jackpot ramp
15. Physical ramp with upper playfield
16. Drop targets bank (3-bank or 5-bank)
17. Motorized target reset animation
18. Moving target or rotating hazard
19. Magna-save on left/right lane
20. Kickback on left outlane (one per ball)
21. Ball trough animation when draining
22. Plunger lane ball eject lighting
23. GI (general illumination) lamp strings tied to events
24. Flashers on jackpot and skill shot
25. Mode-based rule sets (Timed Mode, Carnivore, etc.)
26. Wizard-style mode ladder with shots to lock
27. Video mode mini-game overlay
28. Hologram / mystery award spinner
29. Buy-in continue with credit system
30. Coin door aesthetic and credit dot
31. Operator menu (volume, difficulty, ball count)
32. Difficulty presets (easy / tournament / wizard)
33. Table slope and friction tuning UI
34. Debug overlay for collision lines
35. Replay recorder (export launch path as GIF)
36. Touch-friendly mobile layout with on-screen flippers
37. Haptic feedback on supported phones
38. Gamepad support (triggers = flippers)
39. Keyboard remapping
40. Accessibility: color-blind modes, larger HUD
41. i18n / localized HUD strings
42. Seasonal table mods (Halloween bumpers, etc.)
43. Achievements system (Steam-style badges)
44. Daily challenge seed (fixed launch power / goals)
45. Speedrun timer and split display
46. Table editor (place bumpers/walls in browser)
47. Import/export table JSON for custom layouts
48. WASM port of physics core for performance
49. PWA install + offline play
50. Link to physical pinball controller via Web Serial / Bluetooth

---

## Version History

**71026 10:26:43:78 PM CST**

- HUD Tilt in top score band (scaled %); **Legend** dock button centered under Launch (clear of flippers).

**71026 10:10:54:56 PM CST**

- Controls: tilt **NumPad 7** only; flippers **←→ / W D / Num 1·3**; HUD Tilt pill; dock without Tilt; legend updated.

**71026 5:12:45:50 PM CST**

- **`update .mds`:** PC/Mobile parity Controls table; dock + Legend on both; game-over pinball both devices (no theme packs on v1).

**71026 4:47:52:30 PM CST**

- **`update .mds`:** launch meter holds at max; upper-left stuck-ball fix; serve slash + offline notes (shared with v2 physics).

**71026 3:45:44:35 PM CST**

- **`update .mds`:** Controls-first README complete (legend + mobile dock + game-over pinball restart).

**71026 3:43:05:78 PM CST**

- Mobile game over: **Press here to Restart** + spinning/shining pinball button.

**71026 3:30:07:67 PM CST**

- Legend slide-drawer (**L** / swipe / **[X] Close**); mobile dock + green swipe hint; Controls section at top of README.

**71026 2:49:40:70 PM CST**

- `update .mds`: device-aware touch UI; hub batch via `start-all.ps1`.

**71026 1:41:17:74 PM CST**

- Portable `SCRATCH` default (`os.tmpdir()/pinball-scratch`) in test/verify scripts for public repo hygiene.

**71026 12:28:26:70 PM CST**

- Doc pointer: successor table is `pinball v2/` (VOID PULSE + theme art layers). v1 remains the NEON NEXUS physics baseline.

**62426 2:58:37:60 CST**

- Added `README.md` with controls, roadmap, and version history.

**62426 (session) CST**

- Added procedural pinball audio (`audio.js`) — bumpers, flippers, drain, tilt, launch, jackpot, and more.
- Removed visible glass-reflection guide lines; made left lane protectors invisible physics-only walls.
- Removed mid-playfield decorative guide walls that acted as phantom colliders.
- Softened bumper anti-magnet forces so the ball reaches flippers reliably.
- Added **R** tilt (2 warnings, 3rd tilt drains ball); restart on game over.
- Added outlane saver bumper, extended inlane post, and left-shelf guard.
- Rebuilt launch path: top wireform rail, kinematic shooter guide, skill-shot exit toward bumpers.
- Fixed plunger lock, shooter-lane intrusion, flipper unstick, three-drain physics, score spam cooldowns.
- Initial **NEON NEXUS** table: Canvas renderer, simulation tests, Monte Carlo drain verification.