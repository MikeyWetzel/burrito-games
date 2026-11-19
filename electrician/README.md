# Sparky — One More Outlet

A tiny portrait arcade puzzle. You are the electrician on a job that was supposed to take five minutes. Rotate wires, drop in the spares, and feed the breaker to every lamp, outlet, and appliance before the clock runs out.

Powered wires glow. When the last gadget wakes up, the room goes warm: lights on. A curious dog chews live work, a puddle shorts anything you energize (sparks, a scorch, a big ZAP, and Sparky's hair), and Hank the homeowner will flip your breaker "to help."

Eight house calls, then overtime that keeps getting meaner. Score and best score stick around in `localStorage`, along with a mute setting. One to three stars per job: fast and no zaps is the good kind of illegal.

## Run

No build and no network assets. From this folder, open `index.html` in a browser.

From the repo root:

```
npx serve
```

Then visit `http://localhost:3000/electrician/`.

Phone portrait is the layout it was drawn for (a Pixel is the target). Mouse, touch, and a keyboard all work.

## Controls

- **Tap or click** a wire to rotate it a quarter turn.
- **Drag** a spare from the tray into a dashed box. Tap a selected spare to spin it first. Drag a spare you placed back to the tray to yank it.
- **Tap the dog** before the chomp. **Tap Hank** before he flips MAIN. If the breaker is open, **tap the panel** to close it.
- **Hint** spends a blueprint and fixes one thing.
- **Pause** is the button at the top left. **Mute** is the speaker at the top right.

Keyboard: arrows or WASD move the cursor, Space or Enter spins, Backspace yanks, 1–9 pick a spare, H hint, M mute, P or Esc pause, R reshuffle.
