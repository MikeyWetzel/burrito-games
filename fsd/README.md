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
- Vehicles (ego cars, Roadster, all traffic incl. school bus, moto, police): 100% our own procedural geometry in vehicles.js (no third-party models). Reference photos (Wikimedia Commons, Tesla FSD visualization screenshots) were used only for side-by-side comparison during development and are not shipped.
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

### 3D models (1.9+)
The vehicle models are ours. Blender Python scripts in `blender/` generate them; there are no third-party meshes.
- The generated `.glb` files are binary, so they are not in git. They live on the server at `burrito/fsd/models/v9/` and can be rebuilt with `blender -b -P blender/build.py -- models/v9 <names>` (Blender 4.2 LTS).
- The game loads them with three.js GLTFLoader + DRACOLoader (MIT, vendored in `vendor/loaders`).
- The Draco decoder (`vendor/draco/draco_decoder.wasm` + `draco_wasm_wrapper.js`, Apache-2.0, from three.js r170 examples) is also binary and server-only.
