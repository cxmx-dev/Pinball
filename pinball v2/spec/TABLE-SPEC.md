# VOID PULSE table spec

Rules the table must obey. Each rule has an ID. `verify/CASES.md` has one case per rule, and `node verify/run-verify.js` checks them all headless.

Table units are simulation pixels: the table is 560 by 860, the ball radius is 12, the shooter lane is x 472 to 524, and the lane top is y 103.

Status is what the checker reported on 2026-10-17 against dump18. **Expected-fail** marks a known open bug. It is still checked and reported. It does not fail the run until it is fixed, and then the mark comes off.

| ID | Rule | Status 2026-10-17 |
|----|------|-------------------|
| S1 | Soft plunge, 20 to 40% power, reaches the field or returns to the plunger. A ball that has left the lane never falls back down it. | pass |
| S2 | Full plunge, 95 to 100% power, rides the U at both 60 and 30 frames a second. | pass (dump20) |
| S3 | No field ball crosses the x=472 divider into the lane, at any speed. | pass |
| S4 | No ball sits still for more than 1 second outside a saucer. | fail (new) |
| S5 | Drawn walls equal collision walls. No invisible walls, and no drawn rail without collision. | fail (new), plus expected-fail for the cyan ramp gap |
| S6 | No ball leaves the table. The ball center stays inside the cabinet (x 35 to 525, y 18 and below). | pass (dump20) |
| S7 | No ball tunnels through a main flipper, at rest or held up. | pass (dump21, metric fixed) |
| S8 | Every Pages HTML page (root, v1, v2) declares an icon, so the console shows no favicon 404. | pass (dump19) |
| S9 | Every post and boinger leaves at least a ball width (24) to every other collidable and to the flipper sweep, so it makes no pinch pocket. | pass (dump21) |

## S1 Soft plunge reaches the field

From pass C, dump18. Weak to medium plunges reached the top-right corner, stalled there, fell back down the lane, and drained through the right outlane. The corner exit into the copper slide fixed that. A plunge too weak to reach the lane top returning to the plunger is allowed.

## S2 Full plunge rides the U

From the existing test "600 exits; 800/1400 enter U". The browser frame step can be as long as 1/30 second (`game.js` caps dt at 0.033), so the rule is checked at 1/60 and at 1/30.

## S3 No field ball crosses the divider

From dump17. A fast field ball at y 120 to 170 crossed the zero-width divider in one step and came out on the lane side. A ball coming out of the lane through the corner exit (y 103 to 136) is allowed.

## S4 No ball sits still

From the crown, copper and cusp lodges (dump13, opt2, pass-1b). The three saucers at (95,520), (410,148) and (138,168) hold the ball on purpose and are not counted.

## S5 Drawn walls equal collision walls

From shoe4, dump4 and dump5 (floating sausage, drawn tube with no collision) and pass C (collision without a drawn opening). Checked on the initial table state. The elbow is down and the triangle is up. Moving parts and walls that only some balls hit are not compared. Arch arc pieces that the collision code skips for every ball in the top band are counted as inactive, not invisible.

Expected-fail: `cyan-ramp-gap`. The cyan ramp inner wall from (104,126) to (240,88) collides but is not drawn. This is pass B.

## S6 No ball leaves the table

From the 2026-10-16 clip at 0:29, where the ball fell out of the top-right corner of the rail.

## S7 No tunneling through flippers

From flip-thru, the earlier pass that stopped ball tunneling through the flippers. Shots come from above at 600 to 1600 pixels a second, aimed between 15% and 85% of the bat length. Fixed in the dump21 checker: a pass-through must be a step whose path crosses the bat itself. Before that, a ball that bounced away and later fell past the tip, far from the bat, was counted. The 2 or 3 pass-throughs reported for dump18 to dump20 were all of that kind. With the fixed check, dump20 and dump21 both have 0.

## S8 Page declares an icon

Fixed in dump19. Before that, `index.html` had no `<link rel="icon">`, so browsers requested `/favicon.ico` and logged a 404. The root, v1 and v2 pages now declare `<link rel="icon" href="data:,">`. Every other asset the pages reference (scripts, theme PNGs, the Google font) was checked and exists.

## S9 No pinch pockets

Fixed in dump21 (pass A). The copper boinger moved from (398,686) to (366,648); at (398,686) it was 7.7 from the right filler. The cyan boinger C moved from (125,708) to (156,678); at (125,708) it was sunk into the left sling filler and 11.1 above the chrome cage. Each is now at least 36 clear of every wall, sling, flipper sweep and other boinger. Nothing is marked expected-fail. Sling pins are mounted on their sling and are not checked.
