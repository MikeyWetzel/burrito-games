# FSD Mad Max — progress
- [x] Reference photos reviewed. Researched the FSD viz (grey vehicles, blue planned path, in-path lead car tinted blue)
- [x] three.js r170 vendored in vendor/
- [x] Game: index.html, style.css, game.js (Catmull-Rom road with curves, hills, banking, 3→4 lanes, exit ramp, overpasses; traffic with blinkers and brake lights; Roadster + steam thrusters; WebAudio; HUD)
- [x] Playwright screenshots in shots/ (phone 390x844, landscape 1920x1200), 0 console errors. Iterated on camera, car shapes, steam, and layout
- [x] GitHub repo MikeyWetzel/fsd-madmax
- [x] Deployed to https://apps.bobacat.cafe/fsd/ (all four files return 200 from the server, cache flushed)
- [x] v2 / rev 1.2: lofted smooth vehicle models (sedan, SUV, pickup, van, box truck, semi, bus, motorcycle), clearcoat ego with studio env reflections, sleeker Roadster, camera matched to the photos, narrower path with soft glow, joystick throttle, traffic rules, speed-scaled pass points with +N popups, tunnels with wall/ceiling driving, rev label. Deployed to /burrito/fsd/

## Rev 1.3 (shipped scope: driving feel)
- Absolute finger-height throttle (bottom = limit, top = 100 mph); lift = gentle coast (-6 mph/s) to limit.
- Hard braking when finger slides below current speed (-20 mph/s ≈ 0.9 g), brake-light glow + slight nose-dip pitch.
- Closer chase camera; speed tiers Sloth/Chill/Standard/Hurry/Mad Max from actual speed.
- Traffic: limit+0–8 (cars), +0–4 (trucks/buses); nothing rams from behind; signalled cut-ins in front only when TTC > 3.2 s, 1.6 s blinker, abort if TTC < 2.5 s.
- Steam-jump roof landings (ride + roll off the front), only ground side/rear hits crash.
- Tunnel: road ramps down 6.5 m into a round portal (dark headwall + LED ring), LED light rings inside, no collapsed gray wall, camera roll/pos jitter fixed (shortest-angle roll, no snap at portal, smooth cam rate).
- Play-count ping (../shared/stats.js BurritoPlay('fsd')) at each round start, not page load.
- window.FSD only with ?test.

## Deferred (specs kept; WIP code saved in /workspace/fsd-madmax-wip14, NOT in 1.3)
### 1.4 Tesla look
- Vehicle models per NATA refs (refs/nata-*, golf-cart-vis.jpg): smooth off-white matte traffic, glass a few shades darker, large light hubs, dark lower diffuser; optional CC0 base models (Kenney Car Kit downloaded to /tmp/kcar, CC0) restyled; <1.5 MB; credit in README; model compare shots.
- FSD v14 blue underglow under ego.
- Light/Dark mode (Auto follows prefers-color-scheme, Auto/Light/Dark segmented) for UI + visualization.
- Park splash: selected car 3D 3/4 orbit, status bar (time/temp/battery/range), gear shifter strip D/N/P/R; slide up to D starts (camera swings behind), slide to R springs back with blip; hint "Slide up to Drive".
- Settings screen (Tesla Controls style per Mikey photo ead554d5…jpg: #2c2c2e bg, #3a3a3c panels, 1px borders, 8px radius, selected segment #8e8e93, blue #3e6ae1, slider, status bar, dock with big number). Montserrat (OFL) self-hosted. Tabs: Controls, Driving (density, difficulty), Vehicle (Model 3/Y/S/X/Cybertruck + Tesla paint names, 3D preview), Display (theme, camera Near/Far, quality, FPS), Sound (on/off, volume), Roadster, About (rev, reset unlocks). Pause button in-game. Persist in localStorage.
### 1.5
- Roadster range limit+20 (floor/no-touch) .. 150 mph.
- Cop chase after sustained speeding (~15–22 s well above limit, cooldown): matte cop sedan with red/white light bar + road glow; approaches from behind (only exception to no-rear-ram), bumps; BUSTED after 3 bumps or holding close 4.5 s; escape by gap >150 m for 3 s (+800) or cop crashing into traffic (tumble, +1500). Cop capped 96 mph (beatable flat-out).
- Roadster timer pauses during an active chase.
- Roadster pickup = Plaid-style badge (own drawing inspired by the Plaid emblem, no copied asset), spinning/animated with glow.
- Unlockables: Roadster + Tunnels locked by default, start-screen tiles with lock icon; Unlocks.request(id) -> Promise (DEV: resolves immediately; TODO rewarded-ad hook); Reset unlocks in About.
### 1.6
- GTA-style WASTED on crash: slow-mo, grayscale, camera drift, red Pricedown-style text on dark band, hold ~2 s then score/retry. Pricedown's Typodermic EULA forbids webfont/app embedding -> ship only outlined SVG paths (permitted "fixed artwork"); BUSTED variant for cop.
- CA license-plate leaderboard: PHP endpoint (/burrito/stats/leaderboard.php), data outside public_html (~/www/apps.bobacat.cafe/private/), flock, top 100, validation, rate-limit, score cap, no IPs; plate name entry (8 chars A-Z0-9 space), red script "California" (Yellowtail, Apache-2.0), plate chars Oswald (OFL) lookalike; leaderboard view as mini plates; remember last name.

## Backlog: exaggerated speed (Mikey 10/19)
- At 100 and 150 mph, cars should whiz past very fast; the effect scales with speed (exaggerate relative closing speed beyond realism).
- Auto-adjust traffic spacing as speed rises so the game stays fun and dodgeable.
- Clarified: the scale is relative. At the speed limit you match traffic and passing is hard/slow. Closing speed grows steeply (nonlinear) as you speed up, so at high speed cars blow past very fast.
- Must be tweakable: expose speed-exaggeration curve and traffic-spacing knobs as live sliders (dev/tuning panel behind ?test or in settings) and named constants, so Mikey can tune feel during play.

## Rev 1.5 (shipped 2026-10-19)
- Roadster speed range limit+20..150 mph (no touch = limit+20); Plaid-style spinning badge pickup (own drawing).
- Cop chase (Roadster only): red/white bar, closes in slowly, 3 bumps or 4.5 s tailgate = BUSTED (placeholder text; full screen in 1.6). Escape: 150 m gap for 3 s (+800) or cop crashes (+1500).
- Steam Cloud power-up only spawns during a chase; cops that hit it crash. Roadster timer paused during an active chase.
- Unlocks (unlocks.js): Roadster + Tunnels tiles on Park are locked; tap unlocks (DEV), `Unlocks.request(id)` is the hook for rewarded ads. Reset in Settings > About.
- Fixes: darker traffic glass (rebaked models), light-mode HUD/nav arrow contrast. QA in shots/v5/.

## Rev 1.6 (shipped 2026-10-19)
- WASTED (crash) / BUSTED (cop): 0.3x slow-mo, canvas desaturate, FOV zoom + roll drift, red/blue text from Anton vector outlines (words.js; no font embedded), sized to fit phone width; then score card.
- Score card: CA-style plate name entry (8 chars A-Z0-9 space, last name remembered), Submit plate, Slide-to-Drive retry, Back to Park.
- Global leaderboard: /burrito/stats/leaderboard.php (repo copy in server/). Data in ~/www/apps.bobacat.cafe/private/burrito-stats/fsd-leaderboard.json, flock, top 100, name/field validation, sanity caps (score <= 400/s + 3000, <= 2,000,000; distance <= 150 mph), rate limit 5/10 min per client via hourly-rotating salted HMAC + 200/h global; no IPs stored. Leaders tile on Park shows mini plates.
- Progress unlocks replace tap-to-unlock: cumulative passes (localStorage fsdmm_passes). Roadster at 20, Tunnels at 40. Goal text on Park tiles + in-game pill; ROADSTER/TUNNELS UNLOCKED banner mid-run (tunnels apply from next drive). Unlocks.request kept as the future rewarded-ad hook; tap-to-unlock only behind ?test. Reset in About resets unlocks and progress.

## Rev 1.7 (shipped 2026-10-19): Tesla-style vehicle models (was: TOP PRIORITY for 1.7)
Mikey is unhappy with the car/truck models. They must look as close to identical to the Tesla app visualization as possible, using own-built geometry (no extracted assets).
- Per vehicle type (sedan, SUV, pickup, van, box truck, semi, bus, moto...), build custom meshes from scratch, closely tracing the refs (greentheonly asset sheet, notateslaapp screenshots).
- Match proportions, smooth rounded silhouette, roof/glass shape, wheel arches; matte off-white shading with a soft gradient. No toy-like Kenney look.
- Iterate with per-model side-by-side renders (ref vs ours) at a matching camera angle until close.

### 1.7 notes
- vehicles.js builds every traffic type from scratch: superellipse cross-sections lofted along monotone-cubic profiles (roofline, beltline, plan width, tumblehome, ground clearance with carved wheel arches). Glass, light window surround, pillars and lower trim are vertex colours on exact vertex rows (fixed v breakpoints + z breakpoints) so edges stay crisp; soft vertical gradient; matte material. Rounded lathe tyres + recessed hubs.
- Types: sedan, suv, pickup, van, box, semi, bus, moto (with rider), cop (sedan body + light bar). Geometry is built once per type and shared; models/traffic.json (Kenney, 771 KB) is no longer loaded -> vehicles.js is ~20 KB.
- Compare harness: compare.html + cmp.py (ref crop | our render at matched angle); sheets in shots/v7/compare/. Refs: notateslaapp screenshots of the in-car visualization (refs not redistributed).
- Next iteration ideas: per-model tail-light strips always visible (refs show red tails), bumper/rocker banding on SUV rear, hood/grille detail on box truck & semi, cruiser-style motorcycle, dedicated van ref.

## 1.7.1 (hotfix, shipped separately)
- Cheat mode: Settings > Driving, or `?cheat` (persisted). Adds traffic-free shoulders, a CHEAT HUD tag, keeps cop chases, and never submits to the leaderboard. Unlock-all shortcut.

## 1.8
- Offline art loop with 4 rounds: `rounds.sh N` writes shots/v8/rounds/roundN/ (ref | ours sheets, critique.md, overview.png). Viewer: compare.html with `type=ego-m3|my|ms|mx|ct|rs` or a traffic type.
- Ego hero is now a lofted Model 3. Pearl White is the default.
  - Low pointed nose, continuous black glass roof, glossy clearcoat, dark 19in-look rims, slim headlamps.
  - Model Y/S/X use the same loft with their own proportions. The Cybertruck builder moved to vehicles.js.
- Roadster now appears only during the power-up. It was rebuilt as a low, wide, pointed loft with a targa.
- Settings migration: an unknown or legacy saved model falls back to Model 3 Pearl White.
- Traffic changes:
  - New school bus (wide hood, black grille, window band, rub rails).
  - Cruiser motorcycle.
  - Police is now an SUV with a long low light bar.
  - Van has a Sprinter-style nose.
  - Box truck and semi have crisp z-aligned windscreens.
  - Transit bus has a wrap windscreen.
- Tail lights are always dim red and go bright when braking.
- Remaining gaps: no door handles or panel lines on the ego cars, no falcon-wing X, no Cybertruck arch cladding, capsule moto rider.

## 1.9
- New model pipeline: Blender 4.2, run headless from Python (`blender/carlib.py`, `blender/models.py`, `blender/build.py`). The models are subdivision-surface cages built from side and plan profiles, with feature-line creases, boolean wheel arches and smooth shading. They are exported as Draco-compressed glTF to `models/v9/*.glb`, about 0.8 MB for 14 models.
  - Rebuild: `blender -b -P blender/build.py -- models/v9 m3 my ms mx rs sedan suv cop pickup van box semi bus school`
- `models.js` uses the vendored GLTFLoader and DRACOLoader (`vendor/loaders`, `vendor/draco`). The game preloads every model with top-level await and swaps in shared materials by name: paint, glass, trim, tail, lamp, drl, tyre, rim, spoke.
- Viewer: `compare.html?type=glb-<name>`. `rounds9.sh N` writes the side-by-side sheets to `shots/v9/rounds/roundN/`, alongside the critiques.
- The Model 3 hero, Y/S/X and Roadster (ego) and all traffic except the moto now come from these models. The Cybertruck and moto are still procedural.
- Next: a Blender moto and Cybertruck, panel lines and handles on the ego, Highland C-shaped tail lamps, a flatter M3 roof arc.

## Rev 2.0 — visible cop chase
- Cop now spawns ~34 m back at +10 m/s and drives into view; camera eases back/up during a chase so he is on screen behind you.
- Red/blue light bar + flashing PointLight and road glow (tints road and your car).
- AI: elite phase (3–5 s after he reaches you): matches speed, threads traffic across 2 lanes/shoulder, brakes instead of crashing. Then tired: capped below you while you hold > limit+22 mph, slow reactions, can crash into traffic (WASTED-style wreck → escape). Escape when > 70 m back for 1.2 s.
- WebAudio siren (wail, volume by distance), HUD "🚨 COP xx m" indicator with closeness bar.
- ?cheat / ?test: press P during a run (or call FSDchase()) to start a chase instantly. Headless test: chase20.py → shots/v20/.
