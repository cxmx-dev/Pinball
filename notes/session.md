# Pinball — session notes (public)

Machine paths / full run book: project `USER-NOTES.md` + hub `USER-NOTES.md` (gitignored).

## How to play / push (short)

| Goal | Do |
|------|-----|
| Live (anyone, anytime) | https://cxmx-dev.github.io/Pinball/ → **v2 immediately** (root redirect) |
| Push after edit | hub `.\scripts\start.ps1 -Repo Pinball` → wait for Deployments **light-blue ✓** (not yellow) → hard-refresh |
| Local dev | from `Repos\Pinball`: `npx --yes serve .` → `/` or `/pinball%20v2/` **with trailing `/`** |
| Not for friends | LAN `192.168…` only while your PC is serving |

**Local blank table?** Serve from Pinball folder (not hub); use trailing `/` or `index.html`.

**Pages status (User lesson):** yellow/orange = queued/building; **light-blue check** = success/Active (not green). Deployments list: only the **Active** row is live. Yellow spinner alone may be stale UI — refresh Deployments to confirm.

## Live controls (summary)

- Flippers: **←→ / A D / NumPad 1·3** + mouse/dock  
- Tilt: **NumPad 7** + HUD pill (`6.9%`) — intentionally awkward  
- Dock: L Flip · Launch · R Flip · **Theme \| Legend** (v2) — full row visible on PC  
- Legend: airy rows; mobile hides PC hotkeys column  
- Green PC/swipe hint: **auto-hides** after first input or ~8s (legend keeps the map)

## Stack

| Folder | What |
|--------|------|
| `pinball v1/` | NEON NEXUS — physics, audio, tests |
| `pinball v2/` | VOID PULSE — same play + theme packs (**primary / live**) |
| `index.html` | Pages root → **redirect to v2** |
| `device.js` | Fit + dock chrome on **all** devices |
| `backup/` | Untouched reference — do not edit |
| `PLAN.md` | Local enhance backlog (gitignored) |

## Shipped highlights

- **P2 polish (v2):** theme flash · Launch dims in-play · local high scores · mute · copy score line  
- **P1 depth (v2):** side routes · drop bank → rush · EOB bonus · outlane tension  
- **P0 feel (v2):** hint hide · popup merge · full-dash +800 · graded skill · drain flash + 1× ball-save  
- Launch lane dashes (pass-on, 1.5s hold, reverse accel fade); side power meter  
- Root play link → VOID PULSE (v2) no picker  
- PC dock chrome (Theme\|Legend no longer clipped)  
- Upper-arch / wireform stuck-ball unstick  
- Phases 0–6 theme layer + safeDrawImage fix  
- Launch clamp at max; upper-left unstick  
- Control remap + HUD Tilt + split dock  
- Legend spacing / mobile PC-column hide  
- Offline local play docs; trailing-slash redirect  

## History (condensed)

| When | What |
|------|------|
| 71726 ~3:11 AM | Playtest `2 pinball.mp4` + **P2 polish** + 5× suite green |
| 71726 ~2:53 AM | `update .mds` — P0 feel shipped on v2; docs + tests |
| 71726 ~2:25 AM | Playtest review (`1 pinball.mp4`) → `PLAN.md` P0–P3 backlog |
| 71726 early AM | Root → v2 redirect; PC dock chrome; upper-arch unstick; Pages light-blue ✓ lesson |
| 71126 early AM | `update .mds` — legend mobile PC-column hide + airy desktop rows |
| 71026 night | Controls A/D, NumPad tilt, HUD Tilt, Theme\|Legend, legend UX |
| 71026 PM | Control parity, offline serve docs, launch/unstick physics |
| 71026 day | Hub co-locate, Pages, device-aware, legend drawer, game-over pinball |
