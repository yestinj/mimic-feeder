# Mimic Feeder: Phaser + TypeScript migration plan

The game moves from p5.js to **Phaser 4 + TypeScript**, and its interface is rebuilt to look and feel like a finished game. This plan records what was decided and the order the work happens in. [`inventory.md`](inventory.md) is the checklist of everything the current game does.

## Principles

- **Gameplay ports as it is,** except for the fixes listed in §3.9. Balance tuning comes later.
- **Do it the Phaser way:** use scenes, game objects, tweens, animations and the sound manager. Don't recreate p5's redraw-everything approach (see inventory §15).
- **The interface should look like a proper game,** not a hobby project: real buttons, panels, menus, transitions and feedback.
- **Keep some mystery:** don't over-explain mechanics, and keep secrets secret.
- **Art is out of scope for now:** backgrounds and character sprites stay as they are, and get a later art pass. The UI kit, the UI sounds and the effects are in scope.
- **Ship in small PRs.** Each one passes CI, and the owner reviews it before it merges.

## 1. Screen and layout

- **Design resolution:** 1920×1080 (16:9), scaled to fit the window. Other aspect ratios get thin black bars, and a very small window gets one "make the window bigger" message.
- **Full-width playfield:** horizontal movement (run speed, dash distance) scales with the wider screen, so crossing it takes the same time as today. Fall speeds and spawn timing don't change.
- **Backgrounds:** the 4:3 floor backgrounds are cropped to fill the width, anchored to the floor so the ground line stays right. New 16:9 backgrounds come with the later art pass.

## 2. Visual style

- **Direction: dark-dungeon fantasy.** Dark stone and iron panels, gold trim, warm accents that match the backgrounds.
- **UI kit,** generated in-repo as SVG and loaded as textures:
  - Panels and frames that stretch without distorting.
  - Buttons with normal, hover, pressed and disabled states; tabs; sliders and toggles.
  - XP, boss and cooldown bars.
  - Icons: hearts, abilities, sound, achievement tiers.
  - Keycaps.
- **Fonts:** two open-licence (SIL OFL) fonts, self-hosted: **Grenze Gotisch** (blackletter display font) for titles, headings and buttons, and **Barlow** for text and numbers. Chosen in M0 from a preview of three pairings.
- **One theme module** for colours, type sizes, spacing and animation timings. **One strings module** for all player-facing text, so wording can be reviewed in one place.
- **UI sounds,** generated in-repo and kept subtle: a quiet tick when moving between items, a firmer select, a softer back. They follow the effects volume.

## 3. Features

### 3.1 Navigation and menus

- **Title menu** on every load, returning players included.
  - Items: Play (selected by default), How to Play, Achievements, High Scores, Settings, Credits.
  - Shows the saved name and best score, plus one subtle hint line: "← → move · ↑ jump · Esc menu".
  - The first key press or click also unlocks audio.
  - **It has life:** the mimic breathes there, and now and then lifts its lid for a peek or flips it open with a hop and a wiggle, with dust drifting through the torchlight. The lid's lift, flip and shut each have a soft sound from Kenney's RPG Audio (CC0), chosen with the owner by ear.
  - A "New here? Start here" tag points at How to Play until it has been opened once, or three runs have been played (M4c).
- **Pause menu** (P or Esc):
  - Items: Resume, How to Play, Achievements, Settings, Restart, Quit to menu. K stays a shortcut to Achievements, and H opens How to Play (agreed in M3c). During play both open straight over the run, and closing them goes back to play.
  - A "This run" panel shows floor and zone, time, level, and speed, size, drop-speed and spawn-rate percentages.
  - Restart and Quit ask "Abandon this run?", with Cancel selected by default.
- **The same controls on every screen:** arrows or W/S to move, Enter to select, Esc to go back, and full mouse support. The selected item is clearly highlighted. Multi-page screens use tabs.
- **Quick fades** between screens.
- **Auto-pause:** losing focus (switching tabs, clicking another window) opens the pause menu. Always on (agreed in M4c).
- **Resume countdown (experiment):** 3-2-1 after leaving pause. Easy to remove if it doesn't feel right. Built in M4c as a Settings switch, "Countdown after pausing" (on by default, agreed in M4c): after the pause menu and after How to Play or Achievements opened mid-run, over the run unblurred; P, Esc or losing focus go back to the pause menu.
- **Cursor:** hidden during play; a themed cursor in menus. Built in M4c: a gold arrow, and a brighter one over anything clickable.

### 3.2 HUD

- **Top left:** a large score that counts up, plus Floor and Zone. There's deliberately no "creatures until the next zone" counter.
- **Top right:** hearts with empty sockets, so the maximum is visible; a level badge with an XP bar.
- **Bottom left: ability bar.**
  - One slot per ability (Dash included), each with its keycap, icon and a cooldown that sweeps round the slot.
  - Locked abilities are hidden, and their slot pops in when unlocked.
- **Boss bar:** top centre, with the boss's name and one segment per hit.
- **Feedback:**
  - Hearts shake when one is lost.
  - Low-health warning: the last heart pulses and the screen edge gets a faint red tint.
  - A mute icon shows while sound is off.
- **No in-game onboarding:** the "feeding maw" highlight and the controls panel go. The lid opening near food already shows how eating works.

### 3.3 Notifications

- **Banners** for big moments, shown in the upper third for about 1.5–2 s:
  - New floor, with the floor's name, e.g. "Floor 2: Ageing Lower Halls". The background cross-fades underneath.
  - Boss fight, boss defeated.
- **Unlock notices** for items and abilities: larger, about 4 s, with icon, name and a large keycap ("Press **Space** to cast Shadow Bolt"). At the same time the slot pops into the ability bar with a glow and its keycap pulses.
- **Toasts** for everything else: zone change, level-up (with the speed and size gain), extra life, "New best!" mid-run (once a run, when the score passes the best before it), and achievements. Achievement toasts look like platform achievements: tier badge, name, points.
- **Ninefold Judgment** keeps its own panels, restyled in its purple and red.
- **Queue rules carry over:**
  - Messages are held during the Judgment, and a superseded five-kill warning is dropped.
  - No duplicate messages.
- **"+N" points:** small, rising from the mimic's mouth and fading in under a second. Larger and gold for crowns, diamonds and the boss. The score counter bumps at the same time.
- **Misses** show no text: the splat, the sounds and the heart shake are enough.

**Floor names (Floors 1–10):**
1. Upper Dungeon
2. Ageing Lower Halls
3. Lower Undercroft
4. Buried Crypts
5. Ancient Catacombs
6. Root-Choked Necropolis
7. Underworld Depths
8. Infernal Ruins
9. Void Threshold
10. Abyss (also every floor after 10)

### 3.4 How to Play and Credits

- **How to Play tabs:**
  - **Basics:** goal, eating from the top, lives and potions, growing stronger. Light on exact numbers.
  - **Controls:** keycaps. Abilities not yet unlocked show as "???".
  - **Creatures & Items:** cards with sprite, name, points and one line of behaviour. The health potion is included, and so is the boss (agreed in M3c). The cat card hints at letting cats land, cryptically. The Ninefold Judgment is never mentioned anywhere (a unit test checks).
  - **Abilities:** one card each, locked until first unlocked in any run. A locked one shows "???" with a vague hint at how it's found (agreed in M3c).
- **Discovery:** creatures and items never encountered show as silhouettes with "???" until first met. Discoveries are saved.
- **Credits:** game by Yestin, alpha-tester thanks, version, beta note, open-licence attributions.

### 3.5 Game over and results

- **The moment:** gameplay slows and blurs, "Game Over" appears with the existing sound. About 1.5 s, skippable.
- **Results** tell the story of the run:
  - **Backdrop:** the floor where the run ended, blurred. Header: "Your run ended on Floor 4: Buried Crypts".
  - **Cause of death:** from new tracking of what cost the last life. Draft lines:
    - "Let a perfectly good goblin go to waste"
    - "Blown apart by a bomb"
    - "Scorched by a falling fireball"
    - "Burned by the Flying Demon"
    - "Judged by the dungeon" (only possible once the player has seen the Judgment)

    Final wording gets reviewed with the owner.
  - **The tally, in stages with soft ticks:** "The mimic devoured…" (creature icons and counts), shinies, hazards detonated, bosses. Then the final score lands with a rank ribbon ("New best!", "#3 on the board").
  - **The mimic's growth:** its final size next to its starting size, plus level and time played.
  - **Highlights:** personal bests broken, achievements unlocked this run, new discoveries.
  - Any key skips the animation. Buttons: Play again (default), High Scores, Menu.
  - Built in M4a. Bests don't count as highlights on a first run (everything would), and a new best score shows on its ribbon rather than as a highlight. The soft ticks come with the UI sounds in M4b.
- **The game-over moment** slows play to a stop rather than freezing it (it stops at once with reduced motion).
- **Names:** "Name your mimic" is asked once, the first time a score makes the board. Later scores save automatically ("Saved as …"), and the name can be changed in Settings.
- **High Scores screen:** top 10 with gold, silver and bronze for the top three; name, score, floor and zone, level, time and date; the latest entry highlighted. Since M4a the top three stand on a podium with their medals, and the rest are in a table below.

### 3.6 Achievements

- **Screen:** a grid of medal cards by tier. Each medal shows what it's for (the game's own sprite where there is one), in its tier's metal once earned and dark iron before, with the score it's worth in a tag. The header shows how many are unlocked, the points they've earned and a bar for the whole set. Unlocked cards show the date; locked ones sink back.
- **Progress** is shown on locked measurable achievements, as a bar and a count ("6 / 10").
- **Grind achievements count across all runs:** bolts, dashes, Tentacle uses, hazards detonated, cats rescued, dragons eaten, bosses, total collected, and similar. Milestones (floor, score, level, time survived) stay per run.
- **Secret achievements** show as "???", with a cryptic hint, until earned. Five new ones, on their own tab (agreed in M3b; names and hints are drafts for the M4 text review):
  - Judged and Spared (gold): survive the Ninefold Judgment.
  - Flawless Hunt (gold): defeat a boss without losing a heart during the fight.
  - Hanging by a Thread (silver): reach a new floor with one heart left.
  - Hot Snack (bronze): pull a bomb into the mouth with Magnetism.
  - Feline Felon (bronze): bring the Ninefold Judgment on yourself.
- **Tabs:** Bronze, Silver and Gold (the p5 game's Early, Mid and Late tiers), and Secret. The thresholds stay as they were, so the grind ones come sooner now that they count across runs. The screen opens from the title and pause menus, and with K straight over the run (closing it goes back to play).
- **The score reward stays** (+25, +50 or +100).
- **Unlocking:** a notice with the medal, its name and points. Anything unlocked since the screen was last opened is marked "New" there, with a dot on its tab, and the screen opens on the first tab with something new. A save that has already earned achievements it doesn't have (from runs played before they existed, or after a goal is lowered) unlocks them quietly when it loads, without notices or points.
- **Left for M4:** tune the grind goals once they've been played across runs, and show what was unlocked in the run on the results screen.

### 3.7 Settings

Settings are reachable from the title and pause menus, and save automatically.

- **Audio:** music volume, effects volume (UI sounds included), mute (same as M).
- **Display:** fullscreen (F as a shortcut), screen shake on or off, reduced motion. Both default from the OS setting.
- **Profile:** the mimic's name.
- **Data:**
  - **Reset settings:** back to the defaults, nothing else touched.
  - **Erase save data:** all or nothing. Confirm text: "This erases all your progress and can't be undone". Cancel is the default, and Erase is red.

### 3.8 Saves

- **On first load,** the three old keys are deleted (`mimicFeederHighScores`, `mimicFeederLastUsedName`, `mimicAchievements`). Starting fresh is accepted.
  - **Not before M5:** `/next/` shares its origin, and so its storage, with the live p5 game, whose saves those keys are. The clean-up is built and tested in M3 but stays switched off (`DELETE_P5_SAVES` in `game/src/profile.ts`) until the swap.
- **One versioned save object** replaces them, so future changes can upgrade it. It holds:
  - Name and settings.
  - Top-10 high scores.
  - Achievements with unlock dates.
  - Discoveries and personal bests.
  - Lifetime totals: runs played, creatures eaten by type, and the ability and hazard counters.
- Storage stays wrapped so a blocked or corrupt save never crashes the game.
- **Which runs count:** a run that ends in game over can make the high scores. A run abandoned from the pause menu (Restart or Quit) still adds to the lifetime totals and personal bests, but not the high scores.

### 3.9 Gameplay changes

These are fixes to oversights and changes agreed while playing the rewrite; everything else is ported unchanged.

- **The Magnet** behaves like the Wizard Staff: offered as soon as it unlocks (Floor 3 Zone 1), then occasionally after a miss, until collected.
- **Spawn positions** use the full width correctly; drops currently lean left.
- **Dash** gets its own whoosh sound instead of reusing the Shadow Bolt cast sound.
- **Eating and side hits** (agreed in M1):
  - Food is eaten only when it comes in over the rim: its bottom edge reaches the mouth (the top 30% of the chest), as when it drops in or the mimic jumps up into it. The p5 game also ate food that merely reached the mouth band, so running into tall creatures from the side usually counted as eating.
  - Anything that meets the chest lower down is a side hit: the creature is destroyed and, like food hitting the floor, it costs a life. The p5 game destroyed it for free.
- **Deliberately unchanged:**
  - Shadow Bolt still destroys shinies and power-ups (shoot carefully).
  - Touching a cat waiting on the floor still kills it.

### 3.10 Feel and atmosphere

- **Game-feel pass:**
  - Tiny hit-stop on big hits (a bomb, losing a heart).
  - The lid snaps shut on a bite.
  - Squash-and-stretch, and dust on landing.
  - Screen shake tuned per event. Shake and hit-stop respect the settings and reduced motion.
- **Boss entrance:** an intro card ("The Flying Demon") with a camera push and a rumble.
- **Built in M4b:** hit-stop on losing a heart (70 ms) and on a Shadow-Bolted bomb (45 ms), skipped with reduced motion; the lid snapping shut on every bite; squash and stretch on jumping, landing and biting, with dust on landing; shake tuned per event (hazard hits heaviest, good things lightest); and the boss card, rumble and camera push (no push with reduced motion).
- **Sounds (M4b):** UI sounds (menu moves, select, back, tabs, toggles and sliders), the results' tally ticks and score landing, "New best!" and the boss rumble come from Kenney's CC0 packs (kenney.nl), chosen with the owner by ear. Each was trimmed, peak-normalised and converted to MP3 with ffmpeg; `game/src/assets.ts` notes the pack and file for each, and Credits thanks Kenney. The dash whoosh was made for the game (swept, filtered noise), since none of the packs had a real air whoosh.
- **Ambient effects per floor:** dust, embers, flickering torchlight using Phaser 4 lighting. Kept light, and switched off by reduced motion where it moves a lot.
  - Built in M4c without Phaser's lights (the backgrounds have no normal maps). Each floor has its own air: dust on Floors 1-2, a few embers joining it on 3-4, pale spores on 5-6, thick embers on 7-8, violet sparks on 9-10. The light sources painted into each background (torches, lanterns, spectral glows, lava, the void) glow at their real positions, each kind flickering or pulsing at its own pace; the title shows Floor 1's. With reduced motion the particles stop and the lights hold steady.

### Later (not in this migration)

- New 16:9 backgrounds, character sprites, and possibly the animated mimic sets in `src/assets/_unused/mimic/`.
- Balance tuning, such as the mimic growing 5% per level without limit.
- Gamepad support.

## 4. Technical approach

### Where and how it's built

- **The Phaser game lives in a new top-level folder on `main`.** It's built into `dist/next/`, so the site serves it at **`/next/`** next to the live p5 game.
  - `build.js` runs the Vite build as part of the existing build. That's the same hook the spike used, and Cloudflare's preview served it correctly, so the Cloudflare build settings don't change.
  - `/next/` is unlisted and carries `noindex`.
- **At parity (M5),** the Phaser build moves to the site root, the p5 code and its tooling are removed, and `build.js` is replaced by the Vite build.

### Tooling

- **Vite + TypeScript** (`strict`), Phaser's standard setup.
- **ESLint:** typescript-eslint on its recommended settings, in the same spirit as today: fix findings, or annotate them narrowly.
- **`tsc --noEmit`** runs as part of `npm test`.
- **Built files** get content-hashed names. `src/_headers` gains a long-cache rule for the hashed asset paths and keeps the short-cache rule for HTML. The CSP stays as it is:
  - Images load with `loader.imageLoadType: 'HTMLImageElement'`, so Phaser needs no `blob:` URLs.
  - Fonts are self-hosted.
  - The playtest guards both.

### Code structure

- **One Phaser scene per screen:** Boot/Preload, Title, Game, HUD, Pause, Results, How to Play, Achievements, High Scores, Settings, Credits.
- **Game rules in plain TypeScript modules with no Phaser imports:** spawning, scoring and XP, progression, achievements, save and migration, run stats and cause of death. Scenes call into them, and the modules are unit-tested.
- **Object definitions** (points, weights, unlocks, sizes) are data.
- **Theme and strings** are separate modules.
- **Assets** are reused from `src/assets/`, served under `/assets/`. Nothing is duplicated.

### Testing

- **Vitest unit tests** for the rule modules. They replace most of the regex smoke checks with behaviour tests: spawn gating, Staff and Magnet offers, boss transitions, Judgment waves and gap, achievement counting, save migration and erase.
- **The Playwright playtest** covers `/next/` too:
  - CSP and headers, no errors, audio unlock after a gesture.
  - Pause freezes the game and blocks input; auto-pause on blur.
  - Menu navigation and save/erase.
  - It drives the game through a small test hook the game exposes, instead of p5's bare globals.
- **The post-deploy live check** stays; it gains a `/next/` check until the swap and then moves to the root.
- **CI:** the "Lint, build, smoke, playtest" job keeps its name (the ruleset requires it) and runs the new steps.

## 5. Milestones

Each milestone is one or more PRs. The owner reviews each, and can play the latest build at `/next/` throughout.

| | Milestone | Contents | Done when |
|---|---|---|---|
| **M0** | Foundation | Vite + TS + Phaser project, ESLint, `tsc`, Vitest, `/next/` build and headers, CI steps, theme and strings modules, first UI kit pieces (panel, button, keycap), font shortlist preview and choice | `/next/` shows a styled placeholder title screen; CI green |
| **M1** | Core loop | Mimic movement and lid states, food and hazards with spawning, eating and bumping, lives, XP and levels, zones and floors, floor backgrounds (cropped) and music, sound effects, HUD (score, floor, hearts, XP), pause menu, basic game over | A full run is playable from start to game over |
| **M2** | Full gameplay | Dash, Shadow Bolt, Tentacles, Magnetism with the ability bar; Staff, Magnet and potion offers; cats and rescue; dragons; boss with boss bar; Ninefold Judgment; the gameplay fixes; cause-of-death tracking | Gameplay matches the inventory, with unit tests for the rules |
| **M3** | Menus and saves | Title menu, How to Play with discovery, Achievements (lifetime counters, progress, secrets), High Scores, Settings (including fullscreen and erase), Credits, new save with old-key cleanup | Every screen reachable and working with keyboard and mouse |
| **M4** | Polish | Notification tiers, results story and naming flow, UI sounds and dash whoosh, transitions, title screen life, boss entrance, game-feel pass, ambient floor effects, auto-pause, resume-countdown trial, cursor, final text review with the owner | The owner signs off the look and feel |
| **M5** | Swap | Phaser to the site root, p5 code, globals generator and old smoke checks removed, the old save keys' clean-up switched on, docs (README, AGENTS.md) rewritten, live check moved to root | Live site runs the Phaser version |

The p5 game stays live and unchanged until M5. `AGENTS.md` gets a short note about the migration in M0, and a full rewrite in M5.

## 6. Open items

- **Final wording** for cause-of-death lines, banners, cards and secret achievements: reviewed with the owner in M4.
- **The resume countdown:** kept or removed after trying it in M4.
