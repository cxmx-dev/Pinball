# NEON NEXUS Pinball

Browser pinball built with vanilla JavaScript, HTML5 Canvas, and the Web Audio API. No frameworks, no build step — open `index.html` and play.

> **Successor:** layered Imagine-style theme packs and VOID PULSE identity live in sibling folder `pinball v2/` (same physics baseline, art layers on top).

## Controls

In-game **legend** slides from the **right**: press **L**, or on mobile **swipe right to left fast**. **[X] Close** is bottom-left of the drawer.

### Desktop

| Input | Action |
|--------|--------|
| **← / →** | Left / right flipper |
| **Left click / Right click** | Left / right flipper |
| **Space** hold / release | Charge / launch plunger |
| **R** (during play) | Tilt / nudge (2 warnings, 3rd loses ball) |
| **R** (game over) | Restart game |
| **L** | Toggle controls legend |
| **Esc** | Close legend |

### Mobile / touch

| Control | Action |
|--------|--------|
| **L Flip / R Flip** | Hold bottom dock pads |
| **Table half** | Hold left or right side of the table |
| **Launch** | Hold to charge · release to fire |
| **Tilt** | Nudge · restart on game over |
| **Swipe right → left fast** | Open legend |
| Green **`#00ff00`** dock line | *swipe right to left fast to see the legend* |
| **[X] Close** | Bottom-left of legend |
| **Game over** | **Press here to Restart** — tap the **spinning / shining pinball** |

Desktop: **R** to restart. Mobile: press the animated pinball.

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