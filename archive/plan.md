> **Archive status (2026-07-09):** Historical polish / release-readiness checklist.  
> Almost all items were completed before mid-2026. **Do not use as an active todo list.**  
> Superseded for current pre-merge work by `PRE_MERGE_PLAN.md` (repo root) and for agent orientation by `AGENTS.md`.  
> Later work not covered here: analytics/D1 removal, pause freeze + input guards, bomb double-count fix, lint/smoke/playtest, real OG image, tooling deps.

### TL;DR
Your core loop, state management, and ability systems look solid and in playable beta shape. The game should be fun for short sessions, especially after early power spikes (staff, tentacles, magnet). The biggest issue I found is a logic bug that skews spawn probabilities, which will noticeably affect balance and variety. Past that, most remaining work is polish and small QoL.

Below is an actionable, prioritized checklist to get you release-ready without adding major features.

---

### Priority 1 — Must-fix logic issues and correctness
1) Fix skewed spawn probabilities (major balance bug) — Completed ✓
- Problem: `spawnTable` probabilities are treated as absolute (0–1), summed cumulatively, and compared against `random()` in [0, 1). Because your summed probabilities exceed 1, anything after the point where `cumulativeProb >= 1` gets nearly zero chance (e.g., `OBJ_WRAITH`).
- Fix: Treat the probabilities as weights. Compute `totalProb` as the sum of all eligible `entry.probability`, roll `random() * totalProb`, then select by cumulative weight.
- How:
```js
// In spawnObjects(), in the probability branch
let candidates = [];
let totalProb = 0;
for (const entry of spawnTable) {
  if (!entry.probability) continue;
  if (entry.type === OBJ_DRAGON && (gameState.dungeonFloor < DUNGEON_FLOOR_FOR_DRAGON_SPAWN ||
      (gameState.dungeonFloor === DUNGEON_FLOOR_FOR_DRAGON_SPAWN && gameState.dungeonZone < DUNGEON_ZONE_FOR_DRAGON_SPAWN))) {
    continue;
  }
  if (entry.condition && !entry.condition(currentState)) continue;
  candidates.push(entry);
  totalProb += entry.probability;
}

if (candidates.length) {
  let pick = random() * totalProb;
  let running = 0;
  for (const entry of candidates) {
    running += entry.probability;
    if (pick <= running) { typeToSpawn = entry.type; break; }
  }
}
```
- Impact: Restores intended variety pacing and prevents rare spawns from being silently starved.

2) Verify “pixels per second” naming vs. frame-based movement — Completed ✓
- Originally a naming mismatch (constants looked time-based while updates were frame-based).
- **Later (tech-review Phase 3, 2026-02):** Timing was normalized with `getFrameDelta` / `getDeltaSeconds` and `BASE_DROP_SPEED_PX_PER_SECOND` as true pixels-per-second.

---

### Priority 2 — Player feedback, readability, and onboarding
3) Add a minimal “Click to Start (unmutes audio)” overlay on the intro screen — Completed ✓
- You already gate audio start via `userStartAudio()` on first interaction, but make it explicit so players aren’t confused by silent music/SFX.
- Intro prompt now explicitly states that starting activates audio.
- How: A single centered prompt that disappears on any key press/mouse click and calls `startAudioIfNeeded()`.

4) Tighten copy to match the actual gameplay loop — Completed ✓
- Current meta/README copy says “strategic game where you outsmart opponents,” but the core loop is arcade collection/avoidance with light abilities. Align expectations to avoid mismatch.
- How (examples):
  - Title/Description: “Arcade monster-feeder. Eat creatures, nab shinies, dodge bombs, and unlock powers.”
  - Keep humor/personality around the mimic theme.

5) Clarify ability unlocks in-game (short, non-intrusive toasts) — Completed ✓
- You already show notifications (e.g., staff, tentacles). Ensure each includes the hotkey: “Wizard Staff acquired — press Space to cast Shadow Bolt.” Consistency prevents keybinding confusion.

---

### Priority 3 — Small UX and accessibility polish
6) Add a pause and mute toggle — Completed ✓
- Implemented `P` to pause/resume gameplay (gates updates in `draw()` and shows a Pause overlay).
- Implemented `M` to mute/unmute via `masterVolume(0|1)` and added an on-screen "MUTED (M)" indicator.

7) Improve visual ground alignment and player “eating zone” clarity — Completed ✓
- Added a subtle ground line highlight and a translucent player "EATING ZONE" band for the first ~10s or until ~5 items are collected.

8) Keyboard reminder while playing — Completed ✓
- Added a small translucent controls overlay in the bottom-right for the first ~20s; dynamically includes Space/Z/X lines only when unlocked/available.

---

### Priority 4 — Balance and feel (quick wins, no new features)
9) Early-game pacing — Optional residual (feel tuning only; not blocking)
- Verify `INITIAL_DROP_SPEED_SCALE` and early spawn rate feel forgiving for the first ~20 seconds. If it’s too punishing before the first power spike:
  - Slightly increase early `BASE_OBJECT_SPAWN_RATE_FRAMES` or start with a smaller `dropSpeedScale` and ramp quicker after level 2.

10) Reward signaling — Completed ✓
- For high-value items (`OBJ_CROWN`, `OBJ_DIAMOND`), add a subtle glow or spawn SFX to telegraph their value. You already play ‘collect’; consider a softer, distinct “bling” on spawn only (optional, 1-liner through `playSound()` if you add/alias a sound).

11) Bomb/Fireball fairness — Completed ✓
- Ensure off-screen spawns don’t immediately chain-hit the player. You already keep spawn separation (`MIN_SPAWN_HORIZONTAL_DISTANCE`) and separate attempts; if needed, bias their initial x away from the player by an extra ~30 px when very close.

---

### Priority 5 — Minor correctness/clarity nits worth a quick pass
12) Consistent object sizes — Completed ✓
- Some humanoids use raw sprite dimensions, others use scaled values (e.g., `OBJ_CAT`, `OBJ_WRAITH`, `OBJ_DRAGON`). That’s fine stylistically, but double-check collisions vs. visuals so hitboxes match perceived size.
- Fixed a logic error where Crowns/Diamonds were skipping size assignment; differentiated Crown (45x45) and Diamond (35x35) sizes.

13) Boss cleanup — Completed ✓
- On boss death resolution, you increment floor/zone and remove the boss. Consider clearing stray boss fireballs at the same time to avoid after-death hits:
```js
// When boss death finalizes
bossFireballs.length = 0;
```

14) Sound map safety — Completed ✓
- You already guard on `isLoaded()`. Optionally, set a default `setVolume(DEFAULT_SOUND_VOLUME)` for all sounds at setup to ensure uniformity.

15) Recent-spawn separation also for special spawns — Completed ✓
- You prevent clustering for bombs and normal spawns; make sure staff/potion/magnet spawns pass through the same separation to avoid edge overlap with other objects on arrival frames.

---

### Release-readiness and shareability check
16) Social preview and SEO polish (very quick) — Completed ✓
- Absolute OG/Twitter tags point at `https://mimicfeeder.yest.dev/assets/og-image.png`.
- **2026-07-09:** Real `1200×630` card exists at `src/assets/og-image.png` (composed from game assets; not a blank placeholder).
- Favicon: present.

17) README tighten + link to live demo — Completed ✓
- Add a one-liner link at the top: “Play now: https://mimicfeeder.yest.dev/”
- Make the tone consistent with arcade gameplay; keep the controls list succinct.
- Mention “Desktop recommended. Keyboard required.” to set expectations (no touch controls at the moment).

18) Build/run clarity — Completed ✓
- Your README flow is good. Add “Common issues” line: “If audio is muted on first load, click the page or press any key to activate audio.”

19) Licenses and credits — Completed ✓
- You list CC BY-NC 4.0. If any art/sfx are third-party, include a short “Attributions” section to preempt questions on X/LinkedIn threads.
- Attributions section is present and currently kept intentionally high-level (no detailed source list yet).

20) Crash/console hygiene — Completed ✓
- You already warn when sounds aren’t loaded. Do a quick manual pass in the browser console for a clean, warning-free first boot (especially asset 404s and `og:image`).
- Verified all frame-based asset loops match existing files.

---

### Quick QA checklist (fast to verify)
- Controls
  - Double-tap dash reliably detects within `DASH_DOUBLE_TAP_WINDOW_FRAMES` on 60 Hz and 120 Hz monitors.
  - Shadow Bolt hitboxes feel fair and explosions don’t eat too much perf on clusters.
- Progression
  - Health potions respect `HEALTH_POTION_LEVEL_INTERVAL` and don’t double spawn if the level-up happens on the same frame as a prior check.
- Spawns
  - After fixing weights, confirm each type appears at an intuitive cadence, especially early crowns/diamonds not being too generous.
- Boss
  - No softlocks if the boss dies exactly as a new floor transition trigger would occur.
- Audio
  - Background tracks switch cleanly by level without overlap; `stopAllSounds(true, false)` doesn’t cut critical SFX mid-play during game over.

---

### What’s fun now (keep it!)
- The “power curve” moments (staff, then tentacles, then magnet) are satisfying and give a nice variety spike.
- The popups, splats, and subtle screen shake add nice juice without clutter.
- The dungeon floor/zone framing provides a sense of progress beyond simple score.

### Anything obviously missing?
- Not really, given your “no big changes” constraint. The above polish will go a long way. If you have 1–2 extra hours later, consider a tiny in-round objective (“Rescue 3 cats this floor”) purely as text/UI, not new mechanics, but that’s optional.

---

### Summary of top actions
- Fix spawn probability weighting (most important for fun/variety). — Completed ✓
- Add a click-to-start audio prompt and small in-game control reminders. — Completed ✓
- Align copy/OG tags with arcade gameplay; set a proper absolute `og:image`. — Completed ✓
- Small QoL: pause/mute keys, clear boss fireballs on death, check object size hitboxes. — Completed ✓

### Residual (optional only)
- Early-game pacing feel pass (#9) if a first-20-seconds run still feels too harsh.
- Manual QA checklist above remains useful before a public share; it is not a code backlog.

For current develop→main decisions and dashboard follow-ups, see `PRE_MERGE_PLAN.md` at the repo root.
