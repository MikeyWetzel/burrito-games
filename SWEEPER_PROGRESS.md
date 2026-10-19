# Burrito Sweeper — Flat Calm + live blank-screen fix

## Root cause (Pixel white screen)
Boot waited on Poppins `FontFace.load()` before the first paint. On a slower Android phone that promise can hang or take so long the UI stays a cream/white shell with no board and feels frozen. Queso could also linger. SiteGround `protect_captcha` can additionally serve 403 HTML instead of JS to some clients/IPs (we could not disable it via site-tools).

## Fix (deployed)
- Boot immediately with system-ui; load Poppins in background with 1.5s timeout
- Per-face font load timeout 1.2s; failures ignored
- Queso: `pointer-events: none`, `forceClear()` + safety timer
- Global error + 5s script watchdog banner
- Cache-bust `?v=20261019b` on scripts; `.htaccess` no-cache for js/html
- First-click board gen deferred 30ms off the tap turn

## Commits
- https://github.com/MikeyWetzel/burrito-games/commit/e27d7eb058f0987b01c51a442680d98428b4bed7
- https://github.com/MikeyWetzel/burrito-games/commit/26375b248c73fb1dc32c2cb195f902f6fe9318f9

## Live
https://apps.bobacat.cafe/burrito/burrito-sweeper/
