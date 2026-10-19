# VOID PULSE table verification

`node verify/run-verify.js` runs every case below headless against `simulation.js` and `renderer.js`, reading them only. A full run plays 300 seeded games (`--quick` plays 50). Options are `--games N`, `--seed S` and `--no-json`. Each run writes `verify/last-run.json`, which stays local. The exit code is 1 if any rule that is not expected-fail fails.

**Natural play** is the shared game loop that S1, S3, S4 and S6 also read. It runs N seeded games. Each plunge uses a random 10 to 100% power. The frame step is a random 1/60 or 1/30 second. A simple bot flips each flipper with 70% chance when the ball is below y 600 on its side. A game ends at game over or after 240 seconds.

| Case | Setup | Steps | Pass | How measured |
|------|-------|-------|------|--------------|
| S1 | New table. 300 plunges (60 quick) at a seeded 20 to 40% power, step 1/60 or 1/30. | Tick up to 8 seconds per plunge. | 0 lane fallbacks, here and in natural play. | Fallback means the ball left the lane, then was back in it (x > 474) below y 300. Each plunge is also counted as reaching the field (x < 442 and y > 140) or returning to the plunger. |
| S2 | New table. Power 100% and 95%, each at step 1/60 and 1/30. | Tick up to 240 steps. | All 4 reach the U. | U means left the lane with y < 90 and x between 160 and 400. |
| S3 | 6,000 balls (1,000 quick) at x 300 to 460, y 110 to 750. Speed 200 to 1,600, random direction, marked left lane. Step 1/120, 1/60 or 1/30. | 90 physics steps each. | 0 crossings, here and in natural play. | A crossing is a ball whose previous center was left of x 472 and whose new center is right of x 474, below y 103. |
| S4 | Natural play. | Every tick. | 0 events. | An event is a ball that stays inside a 10 by 10 box for more than 1 second, not in a saucer and not during end-of-ball. One event per ball. |
| S5 | `renderer.js` draws the initial table into a recording canvas (transforms tracked, table offset 20,80 removed). | Sample every collision wall every 4 pixels, and every solid-colour stroke 4 pixels or wider every 4 pixels. | No invisible wall run and no drawn-without-collision run of 10 or more pixels, except known regions. | Drawn means within half the line width plus 5 of a stroke, a fill edge or a circle. A drawn rail has collision if it is within half its width plus 7 of a wall, route segment, sling, flipper, post, bumper, boinger, saucer or spinner. |
| S6 | 4,000 balls (1,000 quick) at x 60 to 452, y 40 to 720, speed 300 to 1,600, random direction. Plus natural play. | 120 steps each. | 0 out-of-bounds, here and in natural play. | Out means the center is at x < 35, x > 525 or y < 18 (above the U outer rail), before a drain. |
| S7 | 2,000 shots (400 quick), alternating left and right, bats at rest or held up 0.5 seconds. | Start 40 pixels above a point 15 to 85% along the bat. Speed 600 to 1,600, within 23 degrees of straight down. Up to 20 steps. | 0 pass-throughs. | A pass-through is a step whose path crosses the bat between 10% and 90% of its length, and ends on the other side (dump21 fix). |
| S8 | Root `index.html`, `pinball v1/index.html` and `pinball v2/index.html`. | Read each file. | Each has a `<link rel="icon">`. | Regex. |
| S9 | Initial table, posts (sling pins skipped) and boingers. | Measure the gap from each object to every other collidable and to each flipper's sweep from rest to up. | No gap between 1 and 24 pixels. | Circle-to-circle and circle-to-segment distance minus radii. A sweep is sampled in 24 angle steps. |

## 2026-10-17 full run, dump18

`node verify/run-verify.js` took 72 seconds and exited 1.

| Rule | Result | Numbers |
|------|--------|---------|
| S1 | PASS | 300 soft plunges: 272 field, 28 returned to the plunger, 0 lane fallbacks. Natural play: 0 fallbacks in 1,191 plunges. |
| S2 | FAIL | 2 of 4. At step 1/30, the 100% and 95% plunges leave the top of the table (y about -216) above the lane, then fall back down the lane. |
| S3 | PASS | 6,000 targeted, 0 crossings. Natural play: 0. |
| S4 | FAIL | 46 events. 21 at the bottom of the copper slide (about 460,340). The rest are at y about 10, which are balls out of the table (see S6). |
| S5 | FAIL | 8 invisible runs on drain chute dividers below the flipper row (x 94, 186, 256, 330, 332, y 760 to 844). 1 drawn orange rail with no collision: the NE join (473,57) to (471,77). 7 known cyan-ramp-gap runs. |
| S6 | FAIL | 58 of 4,000 targeted, 173 in natural play. Mostly at (490 to 500, 10), above the NE corner. Some at (50 to 100, 10), above the NW corner. |
| S7 | FAIL | 3 of 2,000: 2 on the held-up left flipper, 1 on the held-up right. 0 at rest. |
| S8 | XFAIL | No icon link. |
| S9 | FAIL | Known: copper boinger at (398,686) has 7.7 to the right filler. New: cyan boinger at (125,708) has 11.1 to the segment (108,728) to (136,734). |
