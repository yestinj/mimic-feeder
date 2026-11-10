# Mimic Feeder: p5.js feature inventory

Everything the current p5.js game does, written as a checklist for the Phaser + TypeScript rewrite. Gameplay is ported as it is, where feasible; UI and presentation are being redesigned, so the "Current weaknesses" notes are starting points for that discussion, not decisions.

Source: `main` at the time of writing (`src/js/`, `src/assets/`, `src/index.html`). Values are given in seconds or pixels per second where the code uses 60fps frame units (60 frames = 1 s).

## 1. Game flow and screens

| Screen | How you get there | What it shows / does | How you leave |
|---|---|---|---|
| **Intro** | First visit only (no saved name) | Title, short description, full controls list, "Click or press any key to start (activates audio)", version and author in the footer | Any key or click. Starts audio |
| **Gameplay** | After intro; immediately on load for returning players | See §2–§6 | — |
| **Pause** | P during play | Frozen playfield, dimmed, "PAUSED" / "Press 'P' to Resume" | P. M (mute), Esc (help) and K (achievements) still work |
| **Help** | Esc during play or pause | How to play, controls, abilities and their unlock points | Esc closes; ← About, → Object Info |
| **Object Info** | → from Help, ← from About | Every object with its sprite and points, grouped as Consumables, Shinies, Hazards and Power-ups, plus a short description of each group. The fireball is animated | Esc; ← Help, → About |
| **About** | ← from Help, → from Object Info | Beta / portfolio note, Special Thanks (three alpha testers), version | Esc; ← Object Info, → Help |
| **Achievements** | K during play or pause | Unlocked count, paginated list (name, description, unlocked or locked) | Esc; ← → change page |
| **Name entry** | Game over | "Game Over", "Enter Your Name", a text field (letters, digits and spaces, max 10), Submit button | Enter or Submit. An empty name reuses the last saved name |
| **Game over** | After name entry | Final score, floor and zone, player level; Run Breakdown (objects collected and destroyed, cats rescued and their points, per-creature counts and points); High Scores table (top 5: date, name, score, floor/zone, player level, play time); Retry button | Enter or Retry starts a new run, skipping the intro |

Rules that apply across screens:

- **Help, Object Info, About and Achievements** open over a frozen playfield, stop simulation and silence audio while open.
- **Overlays adapt to window size.** If the window is too small for an overlay, a "Resize window for full overlay view" panel is shown instead.
- **Returning players** (a saved name exists) skip the intro, and the run starts at once. Audio waits for the first key press or click.
- **Restarting a run** keeps the mute setting and skips the intro.

## 2. Controls

| Input | Action | Availability |
|---|---|---|
| ← → or A / D (hold) | Move | Always in play |
| Double-tap ← → or A / D within 0.25 s | Dash 100 px in that direction | Always; 1 s cooldown; light screen shake |
| ↑ or W | Jump; again in the air for a double jump | Always |
| Space | Shadow Bolt | After collecting the Wizard Staff |
| Z | Tentacles | From player level 5 |
| X | Magnetism | After collecting the Magnet |
| P | Pause / resume | During play |
| M | Mute / unmute | Anywhere |
| Esc | Open Help; close any overlay | During play or pause |
| K | Achievements | During play or pause |
| Mouse | Intro (click to start), Submit, Retry | Those screens only |

Keyboard only. There is no touch or gamepad support. The README says "Desktop recommended. Keyboard required."

While paused, or while an overlay or game over is showing, gameplay keys do nothing. During the Ninefold Judgment (§6), movement, jump and dash work, but Shadow Bolt, Tentacles and Magnetism are blocked.

## 3. The mimic (player)

- **Size and position:** the chest sprite is drawn at 40% scale, sitting on the ground, which is 14 px above the bottom of the canvas. It can't leave the screen horizontally.
- **Movement:** 360 px/s. Gravity 1800 px/s². Jump velocity 720 px/s upward. Two jumps before landing.
- **Sprite states:**
  - Open: food is within 15 px (bombs and fireballs excluded), Tentacles are active, or the mimic just ate something mid-jump (0.75 s).
  - Ajar: moving, airborne, or just cast a Shadow Bolt (0.25 s).
  - Closed: otherwise.
- **Eating:** food is eaten when it overlaps the mimic while falling, is horizontally over it, and is within the top 30% of the chest (the "mouth"). Food hitting the sides is "bumped" (see §4).
- **Lives:** start at 3, maximum 3.
  - Every 50 humans eaten raises the maximum by 1 and adds a life ("Extra Life Gained!").
  - A health potion restores one life, up to the maximum.
- **XP and player level:**
  - XP equals points earned from eating (and some bonuses).
  - The first level needs 100 XP, and each level doubles the requirement. Leftover XP carries over.
  - Each level multiplies speed and size by 1.05 and jump power by 1.03. The HUD shows speed and size as percentages.
  - A level-up plays a sound. There's no on-screen message, except for Tentacles at level 5 and above.

## 4. Objects

### Falling objects

| Object | Points / XP | Spawn weight | Unlocks | Hits the floor | Notes |
|---|---|---|---|---|---|
| Goblin | 1 | 27.8% | Start | Life lost, splat | |
| Dwarf | 3 | 22.2% | Start | Life lost, splat | |
| Wraith | 7 | 11.1% | Start | Life lost, splat | |
| Human | 10 | 22.2% | Start | Life lost, splat | Counts toward extra max life |
| Elf | 20 | 11.1% | Start | Life lost, splat | |
| Dragon | 25 | 5% | Floor 3 | Life lost, splat | Flies away when the mimic gets close (below) |
| Cat | 0 when eaten | 5.6% | Floor 2 | Sits on the floor, rescued after 3 s for +100 score and XP, then fades | Shooting cats triggers the Ninefold Judgment (§6) |
| Crown | 50 | 3.3% | Start | Glass break, no penalty | Spawn glow (1 s) and "bling" sound |
| Diamond | 100 | 2.2% | Start | Glass break, no penalty | Spawn glow (1 s) and "bling" sound |
| Small bomb | — | Separate roll | Floor 1 Zone 3 | Explodes, no penalty | Touching it costs a life |
| Fireball (hazard) | — | Separate roll | Floor 4 Zone 1 | Bursts, no penalty | Falls 3× faster; touching it costs a life |
| Health potion | — | Special | Every 5 levels (first at Floor 1 Zone 5) | Glass break | +1 life up to the maximum; animated |
| Wizard Staff | — | Special | Floor 2 Zone 1 | Glass break | Grants Shadow Bolt. First offer is immediate; after a miss, 20% chance per spawn |
| Magnet | — | Special | Floor 3 Zone 1 only | Glass break | Grants Magnetism; animated |

Spawn weights are relative and are normalised over whatever is eligible at the time. On Floor 1 (no cats or dragons) they add up to 100%.

**Spawning:**

- **Timing:** one spawn every 2.75 s at the start, faster with each level (see §5). Objects fall at 120 px/s × the level multiplier, with ±25% variation per object.
- **Special items come first:** staff, then potion, then magnet, when their conditions hold and none is already on screen. Otherwise a weighted pick from the table above.
- **Hazards:** from Floor 1 Zone 3, each spawn tick has a 15% chance of adding a hazard. From Floor 4 it's 50/50 bomb or fireball, otherwise a bomb. Hazards are nudged at least 80 px away from the mimic.
- **No clustering:** a new spawn avoids being within 50 px of the last 3 spawn positions (up to 5 attempts).
- **Display sizes** are tuned per sprite (for example the goblin at 1/6 scale, the dwarf at 3×, the bomb at 1/2.5).

**Collisions:**

- **Food eaten from the top:** score and XP, "+N" popup, `collect` sound, and it counts toward zone progress (creatures and cats only; shinies and power-ups don't).
- **Food bumped from the side:** it is destroyed with a splat, with no life lost and no points. It counts as "destroyed".
- **Shinies and power-ups** are collected on any contact.
- **Hazards on contact:** life lost, explosion, screen shake.

**Dragon behaviour:** when the mimic is within 100 px below it, horizontally overlapping, and the dragon is lower than 100 px from the top, it flies off diagonally upward (random angle) at 2× speed for 1–2 s, then falls again. It also starts falling early if it reaches a side wall.

**Cats:**

- **Eaten:** gives 0 points but counts as eaten.
- **Landing:** a cat that reaches the floor waits there 3 s, then is rescued (+100 score and XP, meow) and fades out.
- **Touched on the floor:** touching a waiting cat bumps it (splat).

### Visual effects

- **Bomb explosion:** 7 frames. **Fireball burst:** 16 frames.
- **Ground splat:** 8 frames, used for misses, bumps and clearing the board.
- **Shadow Bolt hit:** a 12-frame humanoid splat.
- **Popups:** "+N" rises and fades over 1 s.
- **Screen shake:** at various strengths. It is skipped when the OS asks for reduced motion.

## 5. Progression

- **Zones:** eating 10 creatures (cats included) advances one zone. Floors have 5 zones. A "Floor N Zone M" banner shows, with the `level_complete` sound.
- **Level number:** level = (floor − 1) × 5 + zone.
- **Difficulty:** multiplier = 1 + (level − 1) × 0.05. Drop speed scales up by it; spawn interval scales down by it (minimum 10 frames). Objects already falling take the new speed.
- **Backgrounds:** one per floor for Floors 1–10 (upper dungeon → abyss). Floor 10's background stays for every later floor. Later backgrounds load in the background, with the closest loaded earlier floor shown until they arrive.
- **Music:** Floors 1–2 and 5–6 (repeating every 4 floors) use track 1; Floors 3–4 and 7–8 use track 2. The boss has its own track. Music is silent during the boss death cue and the Ninefold Judgment.

### Boss (even floors)

- **When:** reaching Zone 5 on an even floor (2, 4, 6, …) starts a boss fight instead of a normal zone.
- **Clearing the board:** every object on screen is destroyed with splats and explosions.
- **Staff guarantee:** the Wizard Staff is granted if missing, because only Shadow Bolt damages the boss.
- **Entrance:** "BOSS FIGHT!" banner. Nothing else spawns during the fight.
- **Flying demon:**
  - 150 px. Health is 10, plus 2 for each earlier boss (Floor 2: 10, Floor 4: 12, …), shown as a bar above it.
  - Idle for 1 s at the start, then flies left and right.
  - Fires fireballs straight down. The cooldown is 3 s × a random 0.15–1.2, divided by the floor multiplier.
  - The floor multiplier is 2^floor((floor − 2) / 2), capped at 4×. It scales both boss speed and fireball speed.
- **Damage:** touching the boss is safe; only its fireballs cost a life. Each Shadow Bolt hit plays a hit animation, during which it doesn't move or fire.
- **Defeat:**
  - Reward: +250 score and XP, "Boss Defeated!" banner.
  - Sound: boss music stops and the death cue plays.
  - Death animation (2 s), then the next floor, Zone 1.

## 6. Abilities

| Ability | Key | Unlock | Cooldown | Behaviour |
|---|---|---|---|---|
| **Dash** | Double-tap ← → / A D | Start | 1 s | Instant 100 px move, screen shake, reuses the `cast_spell` sound |
| **Shadow Bolt** | Space | Wizard Staff | 0.25 s | Projectile rising at 420 px/s from the mimic (see below) |
| **Tentacles** | Z | Player level 5 | 3 s | Chains grab the nearest creatures and pull them in (see below) |
| **Magnetism** | X | Magnet | 10 s | Pulls the loot and bombs on screen toward the mimic (see below) |

- **Shadow Bolt:**
  - Bomb: detonates it for +10 score and XP. This counts as a hazard detonation and costs no life.
  - Boss: damages it.
  - Creatures: destroyed, with no points.
  - Crowns, diamonds and power-ups: also destroyed.
  - Fireballs: the bolt passes through them.
- **Tentacles:**
  - Targets the nearest creatures (cats and dragons included). The target limit is 2 at level 5, plus 1 for each later level ("Tentacles +1" notice).
  - The chains take 0.5 s to reach their targets, then pull them in over 1 s, and the targets are eaten.
  - The lid stays open meanwhile, with the `slurp` sound.
- **Magnetism:**
  - On press, it marks the crowns, diamonds and small bombs on screen at that moment; objects spawned later aren't affected.
  - Marked objects move toward the mimic at 5× their fall speed until eaten or destroyed. Bombs therefore come straight at you, which the help text warns about.

The HUD shows icons for unlocked abilities, plus cooldown bars for Z and X.

### Ninefold Judgment (cat-killing consequence)

- **5 cats shot** with Shadow Bolt in one run: a "FIVE INNOCENT LIVES / The dungeon is watching" panel and a voice line. This happens once per run.
- **10 cats shot:** the judgment begins. This also happens once per run.
- **Setup:**
  - Ordinary objects are suspended, not destroyed, and come back afterwards.
  - Effects and projectiles are cleared.
  - Music stops, with a voice line and a strong shake.
  - Queued notifications are held until it ends; a still-queued five-kill warning is dropped.
- **Summoning (5.5 s):** a large apparition fades in over a purple tint. Panel: "TEN LIVES TAKEN / YOU HAVE ANGERED THE DUNGEON / NOW—RUN".
- **Attack:**
  - 9 waves. Each wave is a dense wall of falling fireballs with one gap about the mimic's width, placed relative to the previous one.
  - Waves get faster each time. Meteors are staggered in height and timing.
  - Header: "NINEFOLD JUDGMENT — n / 9".
  - A hit costs a life, with a 0.75 s grace period so overlapping fireballs only cost one.
- **Ending (3.5 s):** "THE DUNGEON RELENTS / For now", a voice line, and the apparition fades out. Objects return and music resumes.
- **No help on screen.** The encounter deliberately shows no corridor marker or instructions, and its messages have no full stops.

## 7. HUD and in-play messages

- **Left panel, "Dungeon Status":** Floor | Zone, Score, Drop Speed %, Spawn Rate %, "Esc : Help".
- **Right panel, "Mimic Growth":** hearts (wrapping onto extra rows), XP current / needed, Level, Speed %, Size %, ability icons (staff, chain, magnet), and the Z and X cooldown bars.
- **Onboarding hints:**
  - For the first 10 s or first 5 items: a highlighted "FEEDING MAW" zone on the chest, and a "STONE FLOOR" line.
  - For the first 20 s: a Controls panel bottom-left, which adds ability keys as they unlock.
- **Floor strip:** a flat grey 14 px strip along the bottom.
- **Centre notifications:** one at a time from a queue (at most 30), with a short gap between them. Two styles:
  - **Banner (single line):** "Floor N Zone M", "BOSS FIGHT!", "Boss Defeated!".
  - **Panel (title, subtitle, optional footer):** item unlocks (staff, magnet, tentacles), "Extra Life Gained!", "Achievement Unlocked! / name / +N points", and the five-kill warning.
  - They show for 2–4 s and are held, not dropped, during the Ninefold Judgment.
- **Boss health bar** above the boss. **Score popups** at the eat or hit position.

## 8. Achievements

- **The set:** 32 achievements in three tiers, which add score when unlocked (Early +25, Mid +50, Late +100).
- **Progress:** checked every frame against **this run's** stats.
- **Saving:** unlocks are saved and stay unlocked across runs.
- **When one unlocks:** an "Achievement Unlocked!" panel and the `player_level_up` sound.

| Tier | Achievements |
|---|---|
| Early (8) | First Blood (1 human) · Staff Initiate · Magnet Novice · Cat Lover (rescue 3 cats) · Volatile Rookie (10 hazard detonations) · Treasure Hunter (3 crowns) · Dungeon Explorer (Floor 3) · Survivor (3 min) |
| Mid (12) | Bomb Squad (25 detonations) · Diamond Collector (5) · Dragon Slayer (10 dragons) · Score Chaser (5,000) · Veteran (level 8) · Dungeon Delver (Floor 5) · Demolisher (destroy 75) · Cat Sanctuary (rescue 10) · Boss Hunter (1 boss) · Spell Slinger (250 bolts) · Tentacle Tactician (50 uses) · Blink Striker (125 dashes) |
| Late (12) | Abyss Walker (Floor 8) · Apex Mimic (level 12) · Dragon Feast (25 dragons) · Legend Score (20,000) · Iron Stomach (300 collected) · Cat Kingdom (rescue 25) · Long Haul (30 min) · Boss Slayer (3 bosses) · Arcane Battery (600 bolts) · Tentacle Overlord (150 uses) · Dash Phantom (300 dashes) · Hazard Warden (60 detonations) |

**Counting rules:**

- **Hazard detonations** count only detonations the player caused (touching, shooting, or pulling a hazard in). A hazard that hits the floor doesn't count.
- **Play time** counts active play only: no intro, pause or overlay time.

## 9. Audio

| Sound | Plays on |
|---|---|
| `jump`, `double_jump` | First and second jump |
| `collect` | Eating food, shinies |
| `slurp` | Tentacles |
| `cast_spell` | Shadow Bolt, dash, and (as "bling") crown/diamond spawn |
| `shadowbolt_hit` | Bolt hits a creature or the boss |
| `explode` | Any explosion |
| `splat` | Missed or bumped food, board clear |
| `lose_life` | Losing a life |
| `glass_break` | A shiny or power-up hits the floor |
| `health_potion`, `wizard_staff`, `magnetism` | Collecting those items (`magnetism` also on use) |
| `level_complete` | New zone or floor, boss appears |
| `player_level_up` | Player level-up, extra life, achievement |
| `cat_meow`, `cat_hurt` | Cat eaten or rescued; cat shot |
| `boss_death` | Boss defeated |
| `dungeon_warning`, `dungeon_judgment`, `dungeon_relents` | Ninefold Judgment voice lines |
| `game_over` | Game over |
| Music | `background1`, `background2`, `boss` (looped) |

- **Volumes:** effects default to 0.2. Important effects are 0.5, voice lines 0.85, music 0.4.
- **Unlocking:** audio starts only after the first key or click. Nothing plays before the browser confirms audio is running.
- **When it's silenced:**
  - Muting (M), pausing and every info overlay silence everything, using a master volume as a backstop.
  - Mute survives a restart, but not a page reload.
  - Game over stops everything except the game-over sound.

## 10. Persistence (localStorage)

| Key | Contents |
|---|---|
| `mimicFeederHighScores` | Top 5 runs: `name`, `score`, `gameLevel` (legacy), `dungeonFloor`, `dungeonZone`, `playerLevel`, `date` (YY/MM/DD), `playTime` (s) |
| `mimicFeederLastUsedName` | Last submitted name; its presence also skips the intro |
| `mimicAchievements` | `{ achievementId: true }` |

Every read and write is wrapped so blocked storage (private mode, denied access) falls back to empty data instead of crashing. Corrupt achievement data is cleared.

**The plan needs to decide** whether the Phaser version keeps these keys and formats, so returning players keep their scores and achievements.

## 11. Page, platform and accessibility

- **Canvas:**
  - 4:3 aspect ratio, fitted to the window and letterboxed in black, with `role="application"` and an `aria-label`.
  - Resizing keeps the aspect ratio. While paused, resizing keeps the frozen frame.
- **Page:**
  - Title, description, Open Graph and Twitter tags (`og-image.png`), favicon, and a `<noscript>` message.
  - Hosting: Cloudflare Pages static site, CSP and cache rules in `src/_headers`, Cloudflare Web Analytics added at the edge.
- **Reduced motion:** when the OS asks for it, screen shake is off and the apparition doesn't bob.
- **Version display:** `GAME_VERSION` (1.0.0-beta) and the author appear in the intro and help footers.

## 12. Assets

All under `src/assets/`. `_unused/` is quarantined and not loaded.

- **Mimic:** `chest_closed.png`, `chest_ajar.png`, `chest_open.png`.
- **Creatures and items:** `human`, `goblin`, `elf`, `dwarf`, `wraith`, `cat`, `dragon`, `crown`, `diamond`, `small_bomb`, `staff`, `chain` (PNG).
- **Animations (frame sequences):**
  - Hazards and items: `fireball` (30), `fireball_burst` (16), `bomb_explosion` (7), `health_potion` (16), `magnet` (3).
  - Shadow Bolt and splats: `shadow_bolt` (4), `humanoid_splat` (12), `humanoid_splat_ground` (8).
  - Boss (`bosses/flying_demon/`): `fly` (8), `idle` (6), `get_hit` (7), `die` (17), `fireball/PNG` (30).
- **Backgrounds:** 10 floor backgrounds (`backgrounds/*.webp`) and `ninefold_judgment.webp`.
- **Audio:** the 22 sound effects in §9 (MP3) and 3 music tracks (`music/`).
- **Meta:** `favicon.ico`, `og-image.png`.
- **Unused but worth knowing:** `_unused/mimic/` holds animated mimic sprite sets (`idle`, `move`, `attack_A`, `hiding`, `activate`, `die_B`). They could matter for the later art pass.

## 13. Behaviour contracts the current tests guard

`scripts/smoke.js` and `scripts/playtest.js` check these today. Most should become tests in the new version, in whatever form suits Phaser.

- **Pause and overlays:**
  - Pause freezes everything: no movement, play time or spawns.
  - Gameplay keys are ignored while paused or while an overlay is open.
  - M works while paused. Pause survives a window resize.
- **Bombs:** each bomb detonation is counted once (owned by one function). Floor hits don't count.
- **Wizard Staff:** locked before Floor 2 Zone 1; offered immediately once unlocked, then occasionally; never two on screen; stops after collection.
- **Boss:**
  - The boss transition creates exactly one boss and grants a missing staff.
  - Boss music starts; it stops on defeat, followed by the death cue.
  - Speed is capped at 4×.
- **Cats:** none on Floor 1.
- **Ninefold Judgment:**
  - 5-kill warning, 10-kill trigger, 9 waves, narrow gap.
  - Objects suspended and restored. One life lost per overlapping hit.
  - Notifications held. Attack abilities blocked.
- **Audio:** nothing before a user gesture, and no autoplay warnings.
- **Storage:** blocked storage doesn't crash anything.
- **Restart:** resets run state but keeps mute and saved achievements.
- **Assets:** backgrounds advance per floor and hold from Floor 10. Late assets load in the background.
- **Page:** served with the CSP and no violations; no page errors; at most one Cache-Control rule per path.

## 14. Current UI weaknesses (input for the improvements discussion)

- **Inconsistent look:**
  - The HUD and notifications use a dark panel with gold border and Georgia.
  - Intro, Help, Object Info, About and Achievements are flat grey boxes with black text.
  - Pause, name entry and game over are plain text and rectangles.
- **Navigation:**
  - Info screens are linked by arrow keys, with hints written as sentences.
  - There's no menu, no mouse navigation on most screens, and no way to reach Help, Achievements or high scores before a run starts.
  - Returning players drop straight into a run.
- **Missing feedback:**
  - A player level-up has no visual message.
  - There's no mute indicator.
  - The boss health bar is a plain red rectangle.
- **Content gaps:**
  - Object Info leaves out the health potion and the cat rescue.
  - Help says only "Cats are special...".
  - The HUD shows developer-style stats (Drop Speed %, Spawn Rate %).
- **Game over flow:** name entry comes before the player sees their result. The stats and high-score tables are dense, and short names are cut with "...".
- **No settings:** volume, reduced motion and key hints can't be changed in-game.

## 15. p5-specific mechanisms not to port

These exist because of how p5 works. The Phaser plan should use Phaser's own equivalents instead of reproducing them.

| p5 mechanism | Why it exists | Phaser equivalent |
|---|---|---|
| Pause freeze snapshot (`lastGameplayFrame`, `get()`) and draw-loop early returns | p5 redraws everything each frame, so pausing needs a saved image | Pause the gameplay scene; the overlay is another scene |
| Hand-rolled frame timers for every animation | No animation system | Animations from sprite frames, tweens, timers |
| Manual text measuring, wrapping and adaptive overlay scaling | No layout or text objects | Text objects with word wrap, containers, Scale Manager |
| Global state flags (`showHelpScreen`, `isPaused`, …) and one big key handler | One sketch, one draw loop | Scenes with their own input |
| Per-call sound gating and master-gain backstop | p5.sound has no global pause or mute | Sound manager mute, pause and resume |
| Immediate-mode HUD and panels redrawn every frame | — | Persistent game objects, updated only on change |
