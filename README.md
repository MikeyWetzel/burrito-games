# 🌯 Burrito Games

A suite of classic browser games with a burrito twist. Plain HTML/CSS/JS, no build step, works offline.

**Play:** https://mikeywetzel.github.io/burrito-games/

| Game | Status |
|---|---|
| [Burrito Sweeper](burrito-sweeper/) | ✅ Live |
| [Burrito Ninja](burrito-ninja/) | ✅ Live |
| [Flappy Burrito](flappy-burrito/) | ✅ Live |
| Angry Burritos | Coming soon |

## Layout
- `index.html` – suite landing page
- `shared/win98.css` – classic Windows chrome (beveled windows, title bars, LED displays)
- `shared/burrito-art.js` – reusable inline-SVG art (`BurritoArt.burrito()`, `.hotSauce()`, `.salsa()`, `.face(state)`)
- `<game>/index.html` – each game in its own folder

## Burrito Sweeper
Classic Windows Minesweeper clone: Beginner (9×9, 10), Intermediate (16×16, 40), Expert (30×16, 99). First click is always safe (opens a 3×3 area), best times saved in localStorage.
- Desktop: left click reveal, right click flag, click a number / both buttons to chord, F2 new game.
- Mobile: tap reveal (tap a number to chord), long-press to flag.

Run locally: open `index.html` in a browser, or `python3 -m http.server`.
Tests: `node burrito-sweeper/test.js`.

## Burrito Ninja
Fruit Ninja-style slicer on a wooden dojo floor. Swipe (finger or mouse) to slice burritos, tacos, avocados, limes, jalapeños and chips; avoid the ☠ ghost pepper bomb.
- Classic: 3 missed items (✕) or slicing a ghost pepper ends the game.
- Arcade: 60 seconds, no strikes, ghost peppers cost 10 points.
- Combos (3+ in one swipe), critical hits, best scores in localStorage, synthesized sound (mute button), haptics.

## Flappy Burrito
Pixel-faithful Flappy Bird clone at the original 144×256 logical resolution, scaled crisply and letterboxed on any screen. Tap / click / Space to flap through green pipes with salsa-dripping lips. Get Ready screen, Game Over banner, score panel with bronze/silver/gold/platinum medals (10/20/30/40), best score in localStorage, synthesized sounds (mute button), vibrate on hit.
