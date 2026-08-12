# Hub-first: fair center drain between flippers (LOCAL Pinball v2)

Date: 2026-08-12 (America/Chicago)

## Problem
Tip crawls / inlane approaches oscillated forever on bat tips (unstick vy=90 vs flipper collision loft), so center drain felt rare/impossible.

## Changes (simulation.js)
1. FLIPPER_LEN: 2.75/20.25*W (65px) -> 2.5/20.25*W (59px)
   - Rest tip gap: ~50.3px -> ~61.3px (+11px)
   - Pivot spacing unchanged: 169px (107..276)
2. getRestDrainBounds center inset: tip+/-4 -> tip+/-2
   - Center zone width: ~42.3 -> ~57.3px
3. createWalls drain chute: tip+/-6 -> tip+/-4
4. unstickFromFlippers rewrite:
   - Between rest tips: no peel; kill loft (vy*=0.2 if up); floor vy>=70
   - Tip crawl: snap past tip into gap (x = tip +/- (r+4)), vx into gap, vy>=120
   - Mid-bat: decisive into-gap vx floor 90, vy floor 70 (no loft assist)

## Tests (tests/simulation.test.js)
- tipGap assert: >35 && <80 -> >50 && <90
- Added testTipCrawlFallsThroughCenterGap

## Verify
- node run-tests.js PASS (both runs)
- Smoke: center drop low vy drains, no loft above flippers
- Tip-left/right crawls drain ~22-27 frames; inlane approach drains
- Monte Carlo stress 20x: maxStuckSeen=2

## Unchanged
- No git push / start.ps1
- Ball-save rules untouched
- Outlane paths still pass tests
