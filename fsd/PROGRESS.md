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
