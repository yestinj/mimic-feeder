# Phaser spike (not for merging)

A thin slice of Mimic Feeder rebuilt in **Phaser 4.2.1**, used to decide whether to move the game off p5.js. It lives on the `claude/phaser-spike` branch only.

## What's in it

- **Loading screen** with a progress bar driven by Phaser's loader.
- **Start, pause and game-over overlays.** The game world is blurred behind them using a camera filter.
- **The mimic:** moves with ← → (or A/D), jumps and double-jumps with ↑ (or W). The lid opens near food or when eating, and is ajar while moving. It squashes on jump and landing, and kicks up dust when it lands.
- **Falling food** (human, goblin, elf) and **bombs**, with ground shadows:
  - Food is eaten through the top of the chest; side hits knock it away.
  - Food that hits the floor splats and costs a life.
  - Bombs explode, shake the camera and cost a life if they touch the mimic.
- **HUD:**
  - A score that counts up.
  - Floor and zone.
  - Hearts that pop when one is lost.
  - A level badge and an animated XP bar.
  - Floating `+XP` numbers.
  - Banners for level-ups and new zones.
- **Sound and music** through Phaser's audio manager, with M to mute.

Tuning follows the p5 game's constants, converted to per-second units. One deviation: bombs appear from the start instead of from zone 3, so they're quick to try.

## Run it

```bash
npm run build && npm start
```

Then open http://localhost:8080/spike/phaser/index.html. The PR's Cloudflare preview serves it at `/spike/phaser/`.

## Notes

- **Size:** Phaser is bundled with esbuild into `game.js`: 1.4 MB minified, about 377 KB gzipped.
- **CSP:** no change was needed, with one setting. Phaser's default image loading creates `blob:` URLs, which the CSP blocks. Setting `loader.imageLoadType: 'HTMLImageElement'` loads images with plain requests instead.
- **Pause:** pausing stops the whole gameplay scene, so nothing simulates under an overlay. The p5 game needs a freeze snapshot and per-key guards to get the same effect.
- **Code:** the slice is about 780 lines across `spike/phaser/src/`, as ES modules.
