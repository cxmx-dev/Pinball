# NEON NEXUS Pinball

Browser pinball built with vanilla JavaScript, HTML5 Canvas, and the Web Audio API. No frameworks, no build step — open `index.html` and play.

> **Successor:** layered Imagine-style theme packs and VOID PULSE identity live in sibling folder `pinball v2/` (same physics baseline, art layers on top).

## Controls

Legend from the **right** (**L**, **Legend** button, or swipe). Dock on **PC and mobile**. No theme packs on NEON NEXUS (see v2 for **T** / Theme).

| Action | PC | Mobile / dock |
|--------|-----|----------------|
| Left flipper | **←** · **A** · NumPad **1** · LMB | **L Flip** · left table half |
| Right flipper | **→** · **D** · NumPad **3** · RMB | **R Flip** · right table half |
| Charge / launch | **Space** hold / release | **Launch** hold / release |
| Tilt | NumPad **7** only | Compact HUD **Tilt** (lower score band) |
| Legend | **L** or **Legend** | **Legend** centered under Launch · swipe ← |
| Close legend | **L** · **Esc** · **[X]** | **[X]** · **Esc** |
| Game over | Spinning pinball · NumPad **7** | **Press here to Restart** |

**Dock:** L Flip · Launch · R Flip, then centered **Legend** (clear of flippers). No top key-hint strip — use legend.

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

## What's In The Table

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
