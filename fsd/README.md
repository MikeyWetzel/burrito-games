# FSD Mad Max

Phone-first browser game in the style of the Tesla FSD visualization. Built with three.js r170, which is vendored in `vendor/` so nothing loads from a CDN.

Live: https://apps.bobacat.cafe/burrito/fsd/ (the old /fsd/ URL now redirects there)

> **Moved:** the game now lives in the [burrito-games](https://github.com/MikeyWetzel/burrito-games) repo under `fsd/`, as the bonus Tesla-style game in the Burrito Games suite. This repo is kept as the original standalone history.

## Controls (rev 1.2)
- **Virtual joystick from where your finger lands.** Moving left or right steers, tracking your finger directly. Moving up (forward) raises the target speed and moving down lowers it, at 0.42 mph per px after a 12 px dead zone. The throttle **holds when you lift your finger**.
- Speed can't go below the posted limit (65/70) and tops out at 170 mph (+15 in Roadster mode). The ‹ N › number in the bottom bar is your target speed.
- Every other car drives at the limit or up to 15 mph over it, so you can't be rear-ended. Cars behind you brake or change lanes, and cars signal for at least 1 s and won't move into you.
- Each pass scores 10 × (speed/limit)² points, shown as a floating +N. Near miss +100, jump-over +150, wall-ride pass +50, plus distance/10.
- **Tunnels:** keep steering left or right to drive up the walls, across the ceiling upside down, and down the other side. Traffic stays on the floor, so you can drive over it. The camera rolls with the car. Double tap does nothing in a tunnel.
- **Roadster pickups** (red): double-tap to fire the steam thrusters (3 charges).
- Desktop: drag, or ←/→ (A/D) to steer, ↑/↓ (W/S) for throttle, Space to jump, M to mute.

Debug URL flags: `?auto` (AI drives) and `?god` (no collisions). The small grey number in the bottom-left corner is the revision (`REV` in game.js). `window.FSD` exposes test hooks.

Fan-made game, not affiliated with Tesla. All models and UI are drawn procedurally.

## Rev 1.4 credits / licenses
- Traffic car bases (sedan, SUV, pickup, van, box truck): Kenney (no longer used since 1.7) "Car Kit" — CC0 1.0 (www.kenney.nl). Baked to `models/traffic.json`, re-proportioned and restyled to the FSD matte look.
- UI font: Montserrat — SIL Open Font License 1.1, self-hosted `fonts/montserrat-latin.woff2`.
- Everything else (ego Model 3/Y/S/X/Cybertruck, semi, bus, moto, Roadster, UI icons) is drawn procedurally; no Tesla assets or logos.
- Tuning: Settings › Tuning, or `?tune` for a live on-screen panel (speed exaggeration strength/curve, traffic spacing).

### Unlocks (rev 1.5)
Roadster and Tunnels are unlockable from the Park screen. `Unlocks.request(id)` in `unlocks.js` resolves immediately in dev; wire a rewarded ad there later. Reset via Settings > About.

### Rev 1.6 credits
- Oswald (plate characters) — SIL Open Font License 1.1, self-hosted subset in fonts/ (fonts/OFL-Oswald.txt).
- Yellowtail ("California" script) — Apache License 2.0, self-hosted subset (fonts/LICENSE-Yellowtail.txt).
- WASTED/BUSTED artwork: vector outlines generated from Anton glyphs — SIL OFL 1.1 (fonts/OFL-Anton.txt). Pricedown is not used.
- License-plate drawing is our own; not an official California design.

### Rev 1.7
Traffic vehicles are our own procedural geometry (vehicles.js), modelled by eye after public screenshots of the Tesla in-car visualization; no Tesla or third-party model files are used or extracted.

### Cheat mode (1.7.1)
Settings > Driving > Cheat Mode, or open with `?cheat`. Adds traffic-free shoulders for testing long runs and cop chases; cheat runs are excluded from the leaderboard.
