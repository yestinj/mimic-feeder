import * as Phaser from 'phaser';
import { ANIMATIONS, MUSIC, backgroundKey, firstFrame, floorBackground, shownBackgroundIndex } from '../assets';
import { MusicPlayer, playSound } from '../audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y, RUN_SCALE, SIZE_SCALE } from '../config';
import { Boss } from '../game/Boss';
import { FallingObject, objectWidth } from '../game/FallingObject';
import { Judgment } from '../game/Judgment';
import { Mimic } from '../game/Mimic';
import { ShadowBolts } from '../game/ShadowBolts';
import { Tentacles } from '../game/Tentacles';
import { Ambience } from '../game/ambience';
import { GLOW_COLOURS, boltHit, explode, pointsPopup, shake, spawnGlow, splat } from '../game/effects';
import { ABILITIES, Cooldowns, DoubleTap, nearestTargets, type Ability } from '../rules/abilities';
import { BOSS } from '../rules/boss';
import { CAT_FADE_MS, CAT_RESCUE_MS } from '../rules/cats';
import { DRAGON, flight, shouldFlee } from '../rules/dragon';
import { expand, overlaps, resolveContact, type Rect } from '../rules/contact';
import { isCreature, isEdible, isHazard, isPowerUp, isShiny, type ObjectKind, type PowerUpKind } from '../rules/objects';
import { CREATURES_PER_ZONE } from '../rules/progression';
import { dropSpeed, musicForFloor, spawnInterval } from '../rules/progression';
import { Run, type RunEvent } from '../rules/run';
import { SpawnHistory, keepClearOf, pickObject, pickSpawnX, rollHazard } from '../rules/spawner';
import { MIMIC, SPAWNING } from '../rules/tuning';
import { prefersReducedMotion } from '../motion';
import { profile, updateProfile } from '../profile';
import { addTotals, bestsBeaten, bestsWith, recordRun } from '../rules/save';
import { GUIDE_ENTRIES, type GuideKey } from '../rules/guide';
import { TIER_POINTS, newlyEarned, withUnlocked } from '../rules/achievements';
import { markDiscovered, markIntroduced, wasIntroduced } from '../session';
import { DEBUG_MODE, PRACTICE_FLOOR, markReady, setDebugApi, setGameView } from '../testHook';
import { showCursor } from '../ui/cursor';
import { onKeyDown } from '../ui/keys';
import { COLOURS, MOTION } from '../theme';
import type { HudScene } from './HudScene';
import type { ResultsData } from './ResultsScene';
import { GAME_EVENTS } from './SystemScene';

/** Events the game scene emits on its own `events`, for the HUD. */
export const RUN_EVENTS = {
    /** One RunEvent (payload: the event). */
    event: 'run-event',
    /** The run's numbers changed. */
    changed: 'run-changed',
    /** The last life is gone. */
    over: 'run-over',
    /** An ability unlocked that the player has been introduced to before (payload: the ability). */
    abilityNotice: 'ability-notice',
    /** The boss's health changed (payload: { health, max }), or the boss is gone (payload: null). */
    boss: 'boss',
    /** The Ninefold Judgment's phase or wave changed (payload: JudgmentView), or it's over (payload: null). */
    judgment: 'judgment',
    /** An achievement unlocked (payload: the Achievement). */
    achievement: 'achievement',
    /** The score just passed the best before this run (payload: that best). */
    newBest: 'newBest',
} as const;

/** How often achievements are checked during play. */
const ACHIEVEMENT_CHECK_MS = 250;

export interface BossHealth {
    readonly health: number;
    readonly max: number;
}

const DEPTH = { background: -10, ground: -9, ambience: -8, shade: -6, apparition: -5, glow: -1, objects: 0, boss: 0.25, chains: 0.5, mimic: 1, bolts: 1.5, effects: 2, popups: 3 } as const;
/** Dash distance from the p5 game (100 px), across the wider screen. */
const DASH_DISTANCE = 100 * RUN_SCALE;
/** Magnetised objects fly at the mimic at 5× their fall speed. */
const MAGNET_PULL = 5;
/** How long the lid stays open after the tentacles lash out, and ajar after a cast (ms). */
const TENTACLE_LID_MS = 1000;
const CAST_LID_MS = 250;
/** After a boss, new-ability cards wait at least this long into the next floor, and for its banners to finish. */
const CARDS_AFTER_BOSS_MS = 1000;
const POWER_UP_SOUNDS = { staff: 'wizardStaff', magnet: 'magnetism', potion: 'healthPotion' } as const satisfies Record<PowerUpKind, string>;

export interface AbilityState {
    readonly ability: Ability;
    readonly unlocked: boolean;
    /** Cooldown left, 1 (just used) to 0 (ready). */
    readonly cooldown: number;
    /** Attack abilities can't be used during the Ninefold Judgment. */
    readonly blocked: boolean;
}
/** How long the playfield lingers after the last life before the results. */
const GAME_OVER_HOLD_MS = 1800;
/**
 * Screen shake by event (the p5 game's reference strengths): heavy for a
 * hazard hit, light for good things. Skipped when shake is off in Settings.
 */
const SHAKE = { hazardHit: 7, heartLost: 3, bombShot: 4, powerUp: 3, treasure: 2, dash: 2, bossEntrance: 8 } as const;
/** How far the camera pushes in as a boss arrives. */
const BOSS_PUSH_ZOOM = 1.06;
/** A moment's freeze on big hits (ms); skipped with reduced motion. */
const HIT_STOP_MS = { heartLost: 70, bombShot: 45 } as const;

/** How long play takes to slow to a stop as the run ends. */
const GAME_OVER_SLOW_MS = 700;
const BACKGROUND_FADE_MS = 1200;


/** The playfield: the mimic, everything falling, and the run's rules. */
export class GameScene extends Phaser.Scene {
    private run!: Run;
    private mimic!: Mimic;
    private objects!: Phaser.Physics.Arcade.Group;
    private bolts!: ShadowBolts;
    private tentacles!: Tentacles;
    private ambience!: Ambience;
    private boss: Boss | null = null;
    private bossFireballs!: Phaser.Physics.Arcade.Group;
    /** Normal music waits while the boss's death cue plays. */
    private musicHeld = false;
    private judgment: Judgment | null = null;
    /** The tenth cat was shot: the judgment begins at the start of the next frame (after any boss fight). */
    private judgmentPending = false;
    /** Everything on screen when the judgment began, set aside until it ends. */
    private suspended: FallingObject[] = [];
    /** The dungeon's current voice line, so a new one cuts it off. */
    private voice: Phaser.Sound.BaseSound | null = null;
    private cooldowns!: Cooldowns;
    private doubleTap!: DoubleTap;
    private history!: SpawnHistory;
    private music!: MusicPlayer;
    private keys!: Record<'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key>;
    /** [shown, spare]: the spare fades in under the shown one on a new floor. */
    private backgrounds!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
    private shownBackground = '';
    private spawnElapsed = 0;
    /** Test mode can switch the normal spawns off. */
    private spawning = true;
    private ending = false;
    /** The run has been added to the save (it only counts once). */
    private recorded = false;
    private achievementCheckMs = 0;
    /** For the results' highlights: achievements unlocked, and creatures, items and the boss met for the first time, this run. */
    private unlockedThisRun: string[] = [];
    /** The best score before this run, and whether passing it has been announced. */
    private bestToBeat = 0;
    private bestAnnounced = false;
    private metThisRun: GuideKey[] = [];
    private pauseBlur: Phaser.Filters.Blur | null = null;
    /** Abilities unlocked for the first time, waiting to be introduced on a card. */
    private pendingCards: Ability[] = [];
    /** After a boss: cards wait this much more play time (ms), and for the HUD's banners to finish. */
    private cardsWaitMs: number | null = null;
    /** Points scored at the mouth this frame, shown as one pop-up at the end of it. */
    private mouthPoints = { points: 0, treasure: false };
    private readonly random = Math.random;

    constructor() {
        super({ key: 'game', physics: { default: 'arcade', arcade: { debug: DEBUG_MODE } } });
    }

    /** The run in progress, for the HUD and pause screens. */
    get currentRun(): Run {
        return this.run;
    }

    /**
     * Unlocks achievements the run has now earned: lifetime ones count the
     * saved totals plus this run, milestones this run's bests. Each is saved
     * with its date and adds its points; `announce` shows it on the HUD.
     */
    private checkAchievements(announce: boolean): void {
        // Practice runs leave the save alone.
        if (PRACTICE_FLOOR !== null) {
            return;
        }
        const save = profile();
        const run = this.run.record();
        const earned = newlyEarned(save.achievements, addTotals(save.totals, run.totals), bestsWith(save.bests, run));
        if (earned.length === 0) {
            return;
        }
        updateProfile((current) => withUnlocked(current, earned, new Date().toISOString()));
        for (const achievement of earned) {
            this.unlockedThisRun.push(achievement.id);
            this.run.reward(TIER_POINTS[achievement.tier]);
            if (announce) {
                this.events.emit(RUN_EVENTS.achievement, achievement);
            }
        }
        // During the Ninefold Judgment the notice waits for it to end, and so does its sound (it would play over the dungeon's voice).
        if (announce && !this.judgment) {
            playSound(this, 'playerLevelUp');
        }
        this.events.emit(RUN_EVENTS.changed);
    }

    /** Once a run, when the score passes the best before it (if there was one): "New best!". */
    private checkNewBest(): void {
        if (!this.bestAnnounced && this.bestToBeat > 0 && this.run.score > this.bestToBeat) {
            this.bestAnnounced = true;
            // During the Judgment the toast waits for it to end, and so does its sound.
            if (!this.judgment) {
                playSound(this, 'newBest');
            }
            this.events.emit(RUN_EVENTS.newBest, this.bestToBeat);
        }
    }

    /** Restart or Quit from the pause menu: the run counts towards lifetime totals, but not the board. */
    abandonRun(): void {
        // Anything earned since the last check still unlocks, for this run.
        this.checkAchievements(false);
        this.saveRun(false);
    }

    /**
     * Adds the run to the save, once. A run that ended in game over can make
     * the high scores; every run adds to the lifetime totals and bests.
     */
    private saveRun(gameOver: boolean): ResultsData {
        const date = new Date().toISOString();
        const before = profile();
        const record = this.run.record();
        let rank: number | null = null;
        const practice = PRACTICE_FLOOR !== null;
        if (!this.recorded && !practice) {
            this.recorded = true;
            const result = recordRun(before, record, gameOver, date);
            updateProfile(() => result.save);
            rank = result.rank;
        }
        return {
            ...this.run.summary(),
            rank,
            newBest: !practice && this.run.score > 0 && this.run.score > before.bests.score,
            bestBefore: practice ? 0 : before.bests.score,
            date,
            totals: record.totals,
            detonated: { ...this.run.detonated },
            size: this.run.growth.size,
            bestsBeaten: practice ? [] : bestsBeaten(before.bests, before.totals.runs, record),
            achievements: [...this.unlockedThisRun],
            discoveries: [...this.metThisRun],
            practice,
        };
    }

    /** Freezes the action for a moment on a big hit (not on the last heart, and not with reduced motion). */
    private hitStop(ms: number): void {
        const world = this.physics.world;
        if (prefersReducedMotion() || this.ending || this.run.isOver || world.isPaused) {
            return;
        }
        world.pause();
        this.time.delayedCall(ms, () => {
            if (!this.ending) {
                world.resume();
            }
        });
    }

    /** Records meeting something; creatures, items and the boss met for the first time are a highlight of the results. */
    private meet(key: string): void {
        if (PRACTICE_FLOOR === null && markDiscovered(key) && GUIDE_ENTRIES.some((entry) => entry.key === key)) {
            this.metThisRun.push(key as GuideKey);
        }
    }

    /** Each ability's state, for the HUD's ability bar. */
    abilityStates(): AbilityState[] {
        return ABILITIES.map((ability) => ({
            ability,
            unlocked: this.run.hasAbility(ability),
            cooldown: this.cooldowns.fraction(ability),
            blocked: this.judgment !== null && ability !== 'dash',
        }));
    }

    /** The boss's hitbox while it's here, so the HUD can fade what it flies behind. */
    bossBounds(): Rect | null {
        const body = this.boss?.body;
        return body ? { x: body.x, y: body.y, width: body.width, height: body.height } : null;
    }

    /** Where the mimic is, so the HUD can fade what it's standing behind. */
    mimicBounds(): Rect {
        const { x, y, displayWidth, displayHeight } = this.mimic.sprite;
        return { x: x - displayWidth / 2, y: y - displayHeight, width: displayWidth, height: displayHeight };
    }

    create(): void {
        // The scene object is reused on restart, so reset everything here.
        this.run = new Run();
        // A practice run (?test&floor=N) starts deeper, with a steady player's progress.
        if (PRACTICE_FLOOR !== null) {
            this.run.startOn(PRACTICE_FLOOR);
        }
        this.history = new SpawnHistory(SPAWNING.recentPositions);
        this.cooldowns = new Cooldowns();
        this.doubleTap = new DoubleTap();
        this.spawnElapsed = 0;
        this.spawning = true;
        this.ending = false;
        this.recorded = false;
        this.achievementCheckMs = 0;
        this.unlockedThisRun = [];
        this.metThisRun = [];
        this.bestToBeat = PRACTICE_FLOOR === null ? profile().bests.score : 0;
        this.bestAnnounced = false;
        this.pauseBlur = null;
        this.pendingCards = [];
        this.cardsWaitMs = null;
        this.mouthPoints = { points: 0, treasure: false };
        this.boss = null;
        this.musicHeld = false;
        this.judgment = null;
        this.judgmentPending = false;
        this.suspended = [];
        this.voice = null;
        this.shownBackground = '';

        this.physics.world.setBounds(0, 0, DESIGN_WIDTH, GROUND_Y);
        this.addBackground();
        this.mimic = new Mimic(this, DESIGN_WIDTH / 2);
        this.mimic.applyGrowth(this.run.growth);
        this.mimic.sprite.setDepth(DEPTH.mimic);
        this.objects = this.physics.add.group();
        // Grabbed objects belong to the tentacles until they reach the mouth; rescued cats are leaving.
        this.physics.add.overlap(this.mimic.hitbox, this.objects, (_mimic, object) => this.touch(object as FallingObject),
            (_mimic, object) => this.canTouch(object as FallingObject));
        this.bossFireballs = this.physics.add.group();
        this.physics.add.overlap(this.mimic.hitbox, this.bossFireballs, (_mimic, fireball) => this.burn(fireball as Phaser.Physics.Arcade.Sprite));
        this.bolts = new ShadowBolts(this, DEPTH.bolts);
        // Shadow Bolts pass through fireballs.
        this.physics.add.overlap(this.bolts.group, this.objects, (bolt, object) => this.boltHit(bolt as Phaser.Physics.Arcade.Sprite, object as FallingObject),
            (_bolt, object) => (object as FallingObject).def.bolt !== 'pass');
        this.tentacles = new Tentacles(this, DEPTH.chains);

        this.setUpInput();
        this.music = new MusicPlayer(this);
        this.music.play(musicForFloor(this.run.floor));

        const onDeferredLoaded = (key: string): void => this.onDeferredLoaded(key);
        this.game.events.on(GAME_EVENTS.deferredLoaded, onDeferredLoaded);
        this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
        // Auto-pause: losing focus (another tab, another window) mid-run opens the pause menu.
        const onFocusLost = (): void => this.openOverlay('pause');
        this.game.events.on(Phaser.Core.Events.BLUR, onFocusLost);
        this.game.events.on(Phaser.Core.Events.HIDDEN, onFocusLost);
        // No cursor during play; the menu one comes back whenever play stops.
        showCursor(this, false);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GAME_EVENTS.deferredLoaded, onDeferredLoaded);
            this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
            this.game.events.off(Phaser.Core.Events.BLUR, onFocusLost);
            this.game.events.off(Phaser.Core.Events.HIDDEN, onFocusLost);
            showCursor(this, true);
            setGameView(null);
            setDebugApi(null);
        });
        setDebugApi({
            grant: (ability) => this.debugGrant(ability),
            spawn: (kind, x) => this.addObject(kind as ObjectKind, x ?? this.mimic.centerX),
            setSpawning: (on) => {
                this.spawning = on;
                if (!on) {
                    this.activeObjects().forEach((object) => object.destroy());
                }
            },
            startBoss: () => this.debugStartBoss(),
            bonus: (points) => this.apply(this.run.bonus(points), false),
            die: () => {
                while (!this.run.isOver) {
                    this.apply(this.run.detonate('bomb'), false);
                }
            },
            shootCats: (count) => {
                for (let i = 0; i < count; i++) {
                    this.apply(this.run.shootCat(), false);
                }
            },
            damageBoss: (hits) => {
                for (let i = 0; i < hits && this.boss?.alive; i++) {
                    this.hitBoss(this.boss.x, this.boss.y);
                }
            },
        });
        setGameView(() => ({
            score: this.run.score,
            floor: this.run.floor,
            zone: this.run.zone,
            lives: this.run.lives,
            maxLives: this.run.maxLives,
            level: this.run.level,
            playTimeMs: this.run.playTimeMs,
            mimicX: this.mimic.centerX,
            objects: this.objects.countActive(),
            abilities: ABILITIES.filter((ability) => this.run.hasAbility(ability)),
            creaturesEaten: this.run.creaturesEaten,
            shiniesCollected: this.run.shiniesCollected,
            hazardsDetonated: this.run.hazardsDetonated,
            catsRescued: this.run.catsRescued,
            flyingDragons: this.activeObjects().filter((object) => object.flightLeftMs !== null).length,
            waitingCats: this.activeObjects().filter((object) => object.waitedMs !== null && !object.rescued).length,
            boss: this.boss ? { health: this.boss.health, max: this.boss.maxHealth, phase: this.boss.phase } : null,
            judgment: this.judgment ? { phase: this.judgment.phase, gap: this.judgment.gap } : null,
            boltsCast: this.run.uses.shadowBolt,
            food: this.activeObjects()
                .filter((object) => isEdible(object.kind) && object.waitedMs === null)
                .map((object) => ({ x: Math.round(object.x), y: Math.round(object.y) }))
                .sort((a, b) => b.y - a.y),
            cameraFilters: this.cameras.main.filters.external.list.length,
        }));

        this.scene.launch('hud');
        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        markReady('game');
    }

    override update(_time: number, delta: number): void {
        if (this.ending) {
            return;
        }
        // Phaser smooths the frame time and caps it after a stall, and Arcade
        // Physics catches up in fixed steps, so the run's clock uses the same
        // delta as the physics: on a slow machine nothing falls faster than
        // things spawn.
        this.run.tick(delta);
        this.achievementCheckMs += delta;
        if (this.achievementCheckMs >= ACHIEVEMENT_CHECK_MS) {
            this.achievementCheckMs = 0;
            this.checkAchievements(true);
            this.checkNewBest();
        }
        if (this.judgmentPending && !this.run.inBossFight) {
            this.judgmentPending = false;
            this.beginJudgment();
        }
        this.judgment?.update(delta);

        this.spawnElapsed += delta;
        const interval = spawnInterval(this.run.gameLevel);
        if (this.spawnElapsed >= interval) {
            this.spawnElapsed -= interval;
            // Nothing falls during a boss fight but its fireballs, or during the judgment but its fire.
            if (this.spawning && !this.run.inBossFight && !this.judgment) {
                this.spawn();
            }
        }
        this.updateBoss(delta);

        this.cooldowns.tick(delta);
        this.bolts.update();
        const mouth = this.mimic.mouth;
        this.tentacles.update(delta, mouth.x, mouth.y, (target) => this.eatGrabbed(target));
        if (this.tentacles.active) {
            this.mimic.holdOpen(this.time.now);
        }

        const left = this.keys.left.isDown || this.keys.a.isDown;
        const right = this.keys.right.isDown || this.keys.d.isDown;
        this.mimic.update(Number(right) - Number(left), this.foodNearby(), this.time.now);

        for (const object of this.activeObjects()) {
            object.steerTowards(this.mimic.centerX, this.mimic.centerY);
            if (object.kind === 'dragon') {
                this.updateDragon(object, delta);
            } else if (object.waitedMs !== null) {
                this.updateWaitingCat(object, delta);
                continue;
            }
            if (!object.grabbed && object.body.bottom >= GROUND_Y) {
                this.land(object);
            }
        }

        // Creatures reaching the mouth together (say, two on tentacles) get one "+N" rather than overlapping ones.
        if (this.mouthPoints.points > 0) {
            pointsPopup(this, this.mimic.centerX, this.mimic.top - 8, this.mouthPoints.points, this.mouthPoints.treasure).setDepth(DEPTH.popups);
            this.mouthPoints = { points: 0, treasure: false };
        }

        if (this.cardsWaitMs !== null) {
            this.cardsWaitMs = Math.max(0, this.cardsWaitMs - delta);
        }
        // New abilities are introduced at the end of the frame, with the game paused,
        // except from a boss's defeat until the next floor is under way.
        if (this.pendingCards.length > 0 && this.canOpenOverlay() && this.cardsCanOpen()) {
            const abilities = this.pendingCards.splice(0);
            if (PRACTICE_FLOOR === null) {
                abilities.forEach(markIntroduced);
            }
            this.openOverlay('unlock', { abilities });
        }
    }

    private setUpInput(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) {
            throw new Error('Mimic Feeder needs a keyboard');
        }
        const { LEFT, RIGHT, A, D } = Phaser.Input.Keyboard.KeyCodes;
        this.keys = {
            left: keyboard.addKey(LEFT),
            right: keyboard.addKey(RIGHT),
            a: keyboard.addKey(A),
            d: keyboard.addKey(D),
        };
        // Arrow keys and Space would scroll the page.
        keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.SPACE]);
        onKeyDown(this, ['UP', 'W'], () => this.jump());
        onKeyDown(this, ['P', 'ESC'], () => this.openOverlay('pause'));
        // H and K open How to Play and the achievements straight over the run; closing them goes back to play.
        onKeyDown(this, ['H'], () => this.openOverlay('howToPlay', { from: 'game' }));
        onKeyDown(this, ['K'], () => this.openOverlay('achievements', { from: 'game' }));
        onKeyDown(this, ['LEFT', 'A'], (event) => this.tryDash(-1, event.timeStamp));
        onKeyDown(this, ['RIGHT', 'D'], (event) => this.tryDash(1, event.timeStamp));
        onKeyDown(this, ['SPACE'], () => this.castShadowBolt());
        onKeyDown(this, ['Z'], () => this.lashTentacles());
        onKeyDown(this, ['X'], () => this.magnetise());
    }

    /** Test mode only: unlocks an ability through the game's own paths. */
    private debugGrant(ability: string): void {
        if (ability === 'shadowBolt') {
            this.apply(this.run.collectPowerUp('staff'), false);
        } else if (ability === 'magnetism') {
            this.apply(this.run.collectPowerUp('magnet'), false);
        } else if (ability === 'tentacles') {
            while (!this.run.hasAbility('tentacles')) {
                this.apply(this.run.bonus(this.run.xpToNext - this.run.xp), false);
            }
        }
    }

    /** Uses an ability if it's unlocked and off cooldown (and, during the judgment, only Dash); returns whether it did. */
    private useAbility(ability: Ability): boolean {
        if (this.ending || !this.run.hasAbility(ability) || !this.cooldowns.ready(ability)) {
            return false;
        }
        if (this.judgment && ability !== 'dash') {
            return false;
        }
        this.cooldowns.start(ability);
        this.run.use(ability);
        return true;
    }

    /** A second tap of the same direction within a quarter second dashes that way. */
    private tryDash(direction: -1 | 1, time: number): void {
        // Like the p5 game, taps only count while the dash is ready.
        if (this.ending || !this.cooldowns.ready('dash') || !this.doubleTap.press(direction, time) || !this.useAbility('dash')) {
            return;
        }
        const { sprite } = this.mimic;
        const ghost = this.add.image(sprite.x, sprite.y, sprite.texture.key)
            .setOrigin(0.5, 1)
            .setScale(sprite.scaleX, sprite.scaleY)
            .setAlpha(0.45)
            .setDepth(DEPTH.mimic - 0.1);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
        this.mimic.dash(direction * DASH_DISTANCE);
        shake(this.cameras.main, SHAKE.dash);
        playSound(this, 'dashWhoosh');
    }

    private castShadowBolt(): void {
        if (!this.useAbility('shadowBolt')) {
            return;
        }
        this.bolts.fire(this.mimic.centerX, this.mimic.centerY);
        this.mimic.holdAjar(this.time.now + CAST_LID_MS);
        playSound(this, 'castSpell');
    }

    /** Grabs the nearest creatures. Nothing happens (and no cooldown) with none in sight. */
    private lashTentacles(): void {
        if (!this.run.hasAbility('tentacles') || !this.cooldowns.ready('tentacles') || this.judgment) {
            return;
        }
        const creatures = this.activeObjects().filter((object) => isEdible(object.kind) && !object.grabbed && !object.rescued);
        const targets = nearestTargets(this.mimic.centerX, this.mimic.centerY, creatures, this.run.tentacleReach);
        if (targets.length === 0 || !this.useAbility('tentacles')) {
            return;
        }
        this.tentacles.lash(targets);
        this.mimic.holdOpen(this.time.now + TENTACLE_LID_MS);
        playSound(this, 'slurp');
    }

    /** Pulls in the treasure and bombs on screen now; anything that falls later isn't affected. */
    private magnetise(): void {
        if (!this.useAbility('magnetism')) {
            return;
        }
        for (const object of this.activeObjects()) {
            if (object.def.magnetic && !object.grabbed) {
                object.magnetise(MAGNET_PULL);
            }
        }
        playSound(this, 'magnetism');
    }

    private jump(): void {
        if (this.ending) {
            return;
        }
        const jump = this.mimic.jump();
        if (jump === 1) {
            playSound(this, 'jump');
        } else if (jump === 2) {
            playSound(this, 'doubleJump');
        }
    }

    private activeObjects(): FallingObject[] {
        return (this.objects.getChildren() as FallingObject[]).filter((object) => object.active);
    }

    /** Design px/s for the current level. */
    private dropSpeed(): number {
        return dropSpeed(this.run.gameLevel) * SIZE_SCALE;
    }

    private spawn(): void {
        // A power-up that's due takes the place of the normal spawn.
        const onScreen = new Set(this.activeObjects().map((object) => object.kind));
        const kind = this.run.offerPowerUp(onScreen, this.random) ?? pickObject(this.run.floor, this.random);
        this.addObject(kind, this.placeX(kind));

        const hazard = rollHazard(this.run.floor, this.run.zone, this.random);
        if (hazard) {
            const half = objectWidth(this, hazard) / 2;
            const x = keepClearOf(this.placeX(hazard), this.mimic.centerX, SPAWNING.hazardClearance * SIZE_SCALE, half, DESIGN_WIDTH - half);
            this.addObject(hazard, x);
        }
    }

    private placeX(kind: ObjectKind): number {
        return pickSpawnX({
            fieldWidth: DESIGN_WIDTH,
            halfWidth: objectWidth(this, kind) / 2,
            recent: this.history.recent,
            minGap: SPAWNING.minGap * SIZE_SCALE,
            attempts: SPAWNING.placementAttempts,
        }, this.random);
    }

    private addObject(kind: ObjectKind, x: number): void {
        const variation = 1 + (this.random() * 2 - 1) * SPAWNING.speedVariation;
        const object = new FallingObject(this, kind, x, variation);
        this.meet(kind);
        // Adding to a physics group resets velocity, so set the speed after.
        this.objects.add(object);
        object.setDropSpeed(this.dropSpeed());
        object.setDepth(DEPTH.objects);
        this.history.add(x);
        if (kind === 'crown' || kind === 'diamond') {
            playSound(this, 'castSpell');
            spawnGlow(this, object, GLOW_COLOURS[kind], object.displayWidth * 1.8).setDepth(DEPTH.glow);
        }
    }

    /** True when food (not a hazard) is close enough to open the lid. */
    private foodNearby(): boolean {
        const reach = expand(this.mimic.rect(), MIMIC.lidOpenDistance * SIZE_SCALE);
        return this.activeObjects().some((object) => !isHazard(object.kind) && overlaps(reach, object.rect()));
    }

    /**
     * Whether a touch counts. Grabbed objects belong to the tentacles and
     * rescued cats are leaving. A dragon that's about to be touched flies off
     * instead, as in the p5 game, where it checked before anything else.
     */
    private canTouch(object: FallingObject): boolean {
        if (object.grabbed || object.rescued) {
            return false;
        }
        if (object.kind === 'dragon' && object.flightLeftMs === null && this.dragonShouldFlee(object)) {
            this.startDragonFlight(object);
            return false;
        }
        return true;
    }

    /** Something touched the mimic: eaten, hit side-on, collected or set off. */
    private touch(object: FallingObject): void {
        if (this.ending || !object.active) {
            return;
        }
        const kind = object.kind;
        let events: RunEvent[] = [];
        switch (resolveContact(object.def.category, object.rect(), this.mimic.rect(), object.falling)) {
            case 'eat':
                if (isEdible(kind)) {
                    events = this.run.eat(kind);
                }
                this.mimic.bite(this.time.now);
                playSound(this, kind === 'cat' ? 'catMeow' : 'collect');
                break;
            case 'collect':
                if (isShiny(kind)) {
                    events = this.run.collect(kind);
                    playSound(this, 'collect');
                    shake(this.cameras.main, SHAKE.treasure);
                } else if (isPowerUp(kind)) {
                    events = this.run.collectPowerUp(kind);
                    playSound(this, POWER_UP_SOUNDS[kind]);
                    shake(this.cameras.main, SHAKE.powerUp);
                }
                break;
            case 'sideHit':
                // A cat touched any way but through the mouth dies: no life lost, but it cries out.
                if (kind === 'cat') {
                    this.run.killCat();
                } else if (isCreature(kind)) {
                    events = this.run.sideHit(kind);
                }
                splat(this, object.x, object.y, object.displayWidth).setDepth(DEPTH.effects);
                playSound(this, kind === 'cat' ? 'catHurt' : 'splat');
                break;
            case 'detonate':
                if (isHazard(kind)) {
                    // A bomb pulled in by Magnetism is a Hot Snack (a secret achievement).
                    events = this.run.detonate(kind, object.magnetSpeed !== null);
                    explode(this, kind, object.x, object.y, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
                }
                playSound(this, 'explode');
                shake(this.cameras.main, SHAKE.hazardHit);
                break;
        }
        object.destroy();
        this.apply(events, isShiny(kind));
    }

    /** Something reached the floor. */
    private land(object: FallingObject): void {
        const kind = object.kind;
        if (kind === 'cat') {
            // Cats land safely and wait to be rescued.
            object.land(GROUND_Y);
            return;
        }
        let events: RunEvent[] = [];
        if (isCreature(kind)) {
            events = this.run.miss(kind);
            splat(this, object.x, GROUND_Y, object.displayWidth).setDepth(DEPTH.effects);
            playSound(this, 'splat');
        } else if (isShiny(kind) || isPowerUp(kind)) {
            playSound(this, 'glassBreak');
        } else if (isHazard(kind)) {
            explode(this, kind, object.x, GROUND_Y - object.displayHeight / 2, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
            playSound(this, 'explode');
        }
        object.destroy();
        this.apply(events, false);
    }

    /** A tentacle reeled its creature into the mouth. */
    private eatGrabbed(target: FallingObject): void {
        if (this.ending || !target.active) {
            return;
        }
        const kind = target.kind;
        const events = isEdible(kind) ? this.run.eat(kind) : [];
        this.mimic.bite(this.time.now);
        playSound(this, kind === 'cat' ? 'catMeow' : 'collect');
        target.destroy();
        this.apply(events, false);
    }

    /**
     * A cat on the floor is rescued after a while, scores 100 and fades away.
     * Its wait counts play time (each frame's delta), so it stops while the
     * game is paused or the cat is set aside for the Ninefold Judgment.
     */
    private updateWaitingCat(cat: FallingObject, delta: number): void {
        // A cat a tentacle has hold of is on its way to the mouth, not waiting to be rescued.
        if (cat.rescued || cat.grabbed || cat.waitedMs === null) {
            return;
        }
        cat.waitedMs += delta;
        if (cat.waitedMs < CAT_RESCUE_MS) {
            return;
        }
        cat.rescued = true;
        playSound(this, 'catMeow');
        this.apply(this.run.rescueCat(), false, { x: cat.x, y: cat.y - cat.displayHeight / 2 });
        this.tweens.add({ targets: cat, alpha: 0, duration: CAT_FADE_MS, onComplete: () => cat.destroy() });
    }

    private dragonShouldFlee(dragon: FallingObject): boolean {
        return shouldFlee(dragon.rect(), dragon.y, this.mimic.rect(), DRAGON.minHeight * SIZE_SCALE, DRAGON.range * SIZE_SCALE);
    }

    private startDragonFlight(dragon: FallingObject): void {
        const { vx, vy, ms } = flight(DRAGON.flightSpeed * this.dropSpeed(), this.random);
        dragon.fly(vx, vy, ms);
    }

    /**
     * Dragons take fright when the mimic gets close, and fly off until their
     * flight ends or they reach a wall. A flight lasts so much play time
     * (each frame's delta), so it stops while the game is paused.
     */
    private updateDragon(dragon: FallingObject, delta: number): void {
        if (dragon.grabbed) {
            return;
        }
        if (dragon.flightLeftMs === null) {
            if (this.dragonShouldFlee(dragon)) {
                this.startDragonFlight(dragon);
            }
            return;
        }
        dragon.flightLeftMs -= delta;
        const half = dragon.displayWidth / 2;
        if (dragon.flightLeftMs <= 0 || dragon.x - half < 0 || dragon.x + half > DESIGN_WIDTH) {
            dragon.endFlight(this.dropSpeed());
        } else if (dragon.y - dragon.displayHeight / 2 < 0 && dragon.body.velocity.y < 0) {
            // At the top it carries on sideways.
            dragon.setVelocityY(0);
        }
    }

    /**
     * A boss fight begins (Zone 5 of an even floor): the board is cleared, a
     * missing Staff is granted (only Shadow Bolts hurt the boss), and the boss
     * arrives to its own music.
     */
    private startBossFight(): void {
        this.clearBoard();
        if (!this.run.hasStaff) {
            this.apply(this.run.collectPowerUp('staff'), false);
        }
        const boss = new Boss(this, this.run.floor, this.random).setDepth(DEPTH.boss);
        this.boss = boss;
        this.meet('boss');
        // Bolts pass through the boss while it dies.
        this.physics.add.overlap(boss, this.bolts.group, (_boss, bolt) => {
            const sprite = bolt as Phaser.Physics.Arcade.Sprite;
            if (sprite.active) {
                sprite.destroy();
                this.hitBoss(sprite.x, sprite.y);
            }
        }, () => boss.alive);
        this.music.play('boss');
        this.emitBossHealth();
        this.bossEntrance();
    }

    /** The boss arrives: a rumble, and (unless motion is reduced) the camera pushes in and settles back. */
    private bossEntrance(): void {
        shake(this.cameras.main, SHAKE.bossEntrance);
        playSound(this, 'bossRumble');
        if (prefersReducedMotion()) {
            return;
        }
        const camera = this.cameras.main;
        // The camera's zoom takes easing functions, not their names.
        camera.zoomTo(BOSS_PUSH_ZOOM, 450, Phaser.Math.Easing.Sine.Out);
        this.time.delayedCall(1100, () => camera.zoomTo(1, 700, Phaser.Math.Easing.Sine.InOut));
    }

    /** Clears the board for the boss: creatures and cats splat, hazards go off, anything else vanishes. No lives are lost. */
    private clearBoard(): void {
        this.tentacles.clear();
        for (const object of this.activeObjects()) {
            if (isEdible(object.kind)) {
                splat(this, object.x, object.y, object.displayWidth).setDepth(DEPTH.effects);
                playSound(this, 'splat');
            } else if (isHazard(object.kind)) {
                explode(this, object.kind, object.x, object.y, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
                playSound(this, 'explode');
            }
            object.destroy();
        }
    }

    private updateBoss(delta: number): void {
        this.boss?.tick(delta, (x, y, speed) => this.fireBossFireball(x, y, speed), () => this.bossGone());
        for (const fireball of this.bossFireballs.getChildren() as Phaser.Physics.Arcade.Sprite[]) {
            if (fireball.active && fireball.body && fireball.body.bottom >= GROUND_Y) {
                explode(this, 'fireball', fireball.x, GROUND_Y - fireball.displayHeight / 2, fireball.displayWidth, fireball.displayHeight).setDepth(DEPTH.effects);
                playSound(this, 'explode');
                fireball.destroy();
            }
        }
    }

    private fireBossFireball(x: number, y: number, speed: number): void {
        const fireball = this.physics.add.sprite(x, y, firstFrame('bossFireball'));
        // The frames point sideways; turned to fall nose first, as the p5 game drew them.
        fireball.setScale((BOSS.fireballSize * SIZE_SCALE) / fireball.width).setAngle(90).setDepth(DEPTH.objects);
        fireball.play(ANIMATIONS.bossFireball);
        this.bossFireballs.add(fireball);
        fireball.setVelocityY(speed);
    }

    /** A boss fireball hit the mimic. */
    private burn(fireball: Phaser.Physics.Arcade.Sprite): void {
        if (this.ending || !fireball.active) {
            return;
        }
        explode(this, 'fireball', fireball.x, fireball.y, fireball.displayWidth, fireball.displayHeight).setDepth(DEPTH.effects);
        playSound(this, 'explode');
        fireball.destroy();
        this.apply(this.run.burn(), false);
    }

    /** A Shadow Bolt struck the boss at (x, y). The last hit wins the fight: points, the death cue, then the next floor. */
    private hitBoss(x: number, y: number): void {
        const boss = this.boss;
        if (this.ending || !boss?.alive) {
            return;
        }
        boltHit(this, x, y).setDepth(DEPTH.effects);
        playSound(this, 'boltHit');
        if (boss.hit()) {
            this.bossFireballs.clear(true, true);
            this.music.stop();
            // The floor's music comes back once the death cue has played.
            const cue = playSound(this, 'bossDeath');
            this.musicHeld = cue !== null;
            cue?.once(Phaser.Sound.Events.COMPLETE, () => {
                this.musicHeld = false;
                if (!this.ending && !this.run.inBossFight) {
                    this.music.play(musicForFloor(this.run.floor));
                }
            });
            this.apply(this.run.defeatBoss(), true, { x: boss.x, y: boss.y });
        }
        this.emitBossHealth();
    }

    /** The boss's death animation is over: on to the next floor. Any new ability waits until it's under way. */
    private bossGone(): void {
        this.boss?.destroy();
        this.boss = null;
        this.emitBossHealth();
        this.cardsWaitMs = CARDS_AFTER_BOSS_MS;
        this.apply(this.run.finishBossFloor(), false);
    }

    /**
     * Whether a new-ability card may open now. Not while a beaten boss dies,
     * and after one, not until the next floor has begun and the "Boss
     * Defeated!" and new-floor banners have played.
     */
    private cardsCanOpen(): boolean {
        if (this.boss !== null && !this.boss.alive) {
            return false;
        }
        if (this.cardsWaitMs === null) {
            return true;
        }
        const hud = this.scene.get('hud') as HudScene;
        if (this.cardsWaitMs > 0 || hud.bannersBusy) {
            return false;
        }
        this.cardsWaitMs = null;
        return true;
    }

    private emitBossHealth(): void {
        const health: BossHealth | null = this.boss ? { health: Math.max(0, this.boss.health), max: this.boss.maxHealth } : null;
        this.events.emit(RUN_EVENTS.boss, health);
    }

    /** Test mode only: jumps to the next boss fight through the normal path (eating the zone's last creature). */
    private debugStartBoss(): void {
        if (this.run.inBossFight) {
            return;
        }
        if (this.run.floor % 2 === 1) {
            this.run.floor += 1;
            this.showFloorBackground(false);
        }
        this.run.zone = 4;
        this.run.eatenInZone = CREATURES_PER_ZONE - 1;
        this.apply(this.run.eat('goblin'), false);
    }

    /** The dungeon speaks, cutting off anything it was saying. */
    private speak(name: 'dungeonWarning' | 'dungeonJudgment' | 'dungeonRelents'): void {
        this.voice?.stop();
        this.voice = playSound(this, name);
    }

    /**
     * The Ninefold Judgment begins. Everything on screen is set aside (not
     * destroyed, so nothing is lost), bolts, chains and boss fireballs go, and
     * the music stops while the dungeon speaks.
     */
    private beginJudgment(): void {
        for (const object of this.activeObjects()) {
            object.grabbed = false;
            object.magnetSpeed = null;
            object.setActive(false).setVisible(false);
            object.body.enable = false;
            this.suspended.push(object);
        }
        this.tentacles.clear();
        this.bolts.group.clear(true, true);
        this.bossFireballs.clear(true, true);
        this.music.stop();
        this.speak('dungeonJudgment');
        this.meet('judgment');
        this.judgment = new Judgment(this, {
            mimic: () => ({
                rect: this.mimic.rect(),
                centreX: this.mimic.centerX,
                width: this.mimic.rect().width,
                // How far it runs in 35 of the p5 game's frames.
                reach: MIMIC.runSpeed * RUN_SCALE * this.run.growth.speed * (35 / 60),
            }),
            hit: () => this.apply(this.run.judge(), false),
            changed: (view) => {
                if (view.phase === 'ending' && this.judgment?.phase !== 'ending') {
                    this.speak('dungeonRelents');
                }
                this.events.emit(RUN_EVENTS.judgment, view);
            },
            done: () => this.endJudgment(),
        }, this.random, { shade: DEPTH.shade, apparition: DEPTH.apparition, fireballs: DEPTH.objects });
    }

    /** The dungeon relents: everything set aside comes back, and the music resumes. */
    private endJudgment(): void {
        if (!this.ending) {
            this.run.surviveJudgment();
        }
        this.judgment?.destroy();
        this.judgment = null;
        for (const object of this.suspended) {
            if (object.scene) {
                object.setActive(true).setVisible(true);
                object.body.enable = true;
                object.setDropSpeed(this.dropSpeed());
            }
        }
        this.suspended = [];
        this.music.play(this.boss?.alive ? 'boss' : musicForFloor(this.run.floor));
        this.events.emit(RUN_EVENTS.judgment, null);
    }

    /** A Shadow Bolt hit something: bombs go off (for points), everything else is destroyed. */
    private boltHit(bolt: Phaser.Physics.Arcade.Sprite, object: FallingObject): void {
        if (this.ending || !bolt.active || !object.active) {
            return;
        }
        bolt.destroy();
        const kind = object.kind;
        let events: RunEvent[] = [];
        if (object.def.bolt === 'detonate' && isHazard(kind)) {
            events = this.run.shootHazard(kind);
            explode(this, kind, object.x, object.y, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
            playSound(this, 'explode');
            shake(this.cameras.main, SHAKE.bombShot);
            this.hitStop(HIT_STOP_MS.bombShot);
        } else if (kind === 'cat') {
            events = this.run.shootCat();
            boltHit(this, object.x, object.y).setDepth(DEPTH.effects);
            playSound(this, 'catHurt');
        } else {
            this.run.shoot();
            boltHit(this, object.x, object.y).setDepth(DEPTH.effects);
            playSound(this, 'boltHit');
        }
        const at = { x: object.x, y: object.y };
        object.destroy();
        this.apply(events, false, at);
    }

    /** Plays and shows what the run's rules reported, then tells the HUD. Points pop up at `at`, or the mouth. */
    private apply(events: readonly RunEvent[], treasure: boolean, at?: { x: number; y: number }): void {
        for (const event of events) {
            switch (event.type) {
                case 'points':
                    if (at) {
                        pointsPopup(this, at.x, at.y, event.points, treasure).setDepth(DEPTH.popups);
                    } else {
                        // Shown at the end of the frame, added to anything else eaten in the same frame.
                        this.mouthPoints.points += event.points;
                        this.mouthPoints.treasure ||= treasure;
                    }
                    break;
                case 'levelUp':
                    playSound(this, 'playerLevelUp');
                    this.mimic.applyGrowth(this.run.growth);
                    break;
                case 'zone':
                    playSound(this, 'levelComplete');
                    // Everything already falling speeds up too.
                    this.activeObjects().forEach((object) => object.setDropSpeed(this.dropSpeed()));
                    if (event.newFloor) {
                        this.showFloorBackground(false);
                        if (!this.musicHeld) {
                            this.music.play(musicForFloor(event.floor));
                        }
                    }
                    if (event.boss) {
                        this.startBossFight();
                    }
                    break;
                case 'extraLife':
                    playSound(this, 'playerLevelUp');
                    break;
                case 'lifeLost':
                    playSound(this, 'loseLife');
                    // A hazard has already shaken harder; a creature let go gets a lighter one.
                    shake(this.cameras.main, SHAKE.heartLost);
                    this.hitStop(HIT_STOP_MS.heartLost);
                    break;
                case 'unlock':
                    // The first time: a card that pauses the game. After that: a toast.
                    if (!wasIntroduced(event.ability)) {
                        if (!this.pendingCards.includes(event.ability)) {
                            this.pendingCards.push(event.ability);
                        }
                    } else {
                        this.events.emit(RUN_EVENTS.abilityNotice, event.ability);
                    }
                    break;
                case 'catWarning':
                    this.speak('dungeonWarning');
                    break;
                case 'judgment':
                    this.judgmentPending = true;
                    break;
                case 'gameOver':
                    this.endRun();
                    break;
            }
            this.events.emit(RUN_EVENTS.event, event);
        }
        if (events.length > 0) {
            this.events.emit(RUN_EVENTS.changed);
        }
    }

    private addBackground(): void {
        const make = (): Phaser.GameObjects.Image => this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, backgroundKey(0))
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.background);
        this.backgrounds = [make(), make().setVisible(false)];
        this.ambience = new Ambience(this, DEPTH.ambience);
        this.showFloorBackground(true);

        // A soft shadow along the floor, so things land on something.
        const ground = this.add.graphics().setDepth(DEPTH.ground);
        ground.fillGradientStyle(COLOURS.ink, COLOURS.ink, COLOURS.ink, COLOURS.ink, 0, 0, 0.55, 0.55);
        ground.fillRect(0, GROUND_Y - 40, DESIGN_WIDTH, DESIGN_HEIGHT - GROUND_Y + 40);
    }

    private showFloorBackground(instant: boolean): void {
        // The air follows the floor; its lights follow the background actually showing.
        this.ambience.setFloor(this.run.floor, shownBackgroundIndex(this.textures, this.run.floor));
        const key = floorBackground(this.textures, this.run.floor);
        if (key === this.shownBackground) {
            return;
        }
        this.shownBackground = key;
        const [outgoing, incoming] = this.backgrounds;
        incoming.setTexture(key).setAlpha(1).setVisible(true).setDepth(DEPTH.background - 1);
        // Cover the screen, cropping the 4:3 art top and bottom-anchored.
        incoming.setScale(Math.max(DESIGN_WIDTH / incoming.width, DESIGN_HEIGHT / incoming.height));
        outgoing.setDepth(DEPTH.background);
        this.backgrounds = [incoming, outgoing];
        if (instant) {
            outgoing.setVisible(false);
            return;
        }
        this.tweens.add({
            targets: outgoing,
            alpha: 0,
            duration: BACKGROUND_FADE_MS,
            ease: 'Sine.InOut',
            onComplete: () => outgoing.setVisible(false),
        });
    }

    private onDeferredLoaded(key: string): void {
        if (key.startsWith('bg-floor-')) {
            this.showFloorBackground(false);
        } else if (key === MUSIC.music2.key && !this.ending) {
            this.music.play(musicForFloor(this.run.floor));
        }
    }

    /** Play carries on after an overlay closes: the game and HUD resume (the blur and sounds follow, see onResume). */
    resumePlay(): void {
        this.scene.resume();
        this.scene.resume('hud');
    }

    /**
     * Leaving the pause menu, or How to Play or Achievements opened mid-run:
     * with the resume countdown on (Settings), a 3-2-1 over the unblurred run
     * first; otherwise straight back to play.
     */
    returnToPlay(): void {
        if (!profile().settings.resumeCountdown) {
            this.resumePlay();
            return;
        }
        this.removePauseBlur();
        this.scene.launch('countdown');
    }

    /** The countdown was cut short (P, Esc, or losing focus): back to the pause menu. */
    reopenPause(): void {
        this.addPauseBlur();
        this.scene.launch('pause', {});
    }

    /** The playfield's blur under an overlay (once, however often it's asked for). */
    private addPauseBlur(): void {
        this.pauseBlur ??= this.cameras.main.filters.external.addBlur(1, 2, 2, 1);
    }

    private removePauseBlur(): void {
        if (this.pauseBlur) {
            this.cameras.main.filters.external.remove(this.pauseBlur);
            this.pauseBlur = null;
        }
    }

    /** Freezes and blurs the game and HUD under an overlay scene (pause menu, new-ability card, How to Play, achievements); resumePlay undoes it. */
    private openOverlay(key: 'pause' | 'unlock' | 'howToPlay' | 'achievements', data: object = {}): void {
        if (!this.canOpenOverlay()) {
            return;
        }
        this.addPauseBlur();
        this.sound.pauseAll();
        this.scene.pause();
        this.scene.pause('hud');
        showCursor(this, true);
        // Always some data: launched without any, Phaser hands the scene its previous launch's data.
        this.scene.launch(key, data);
    }

    /**
     * An overlay can open: the run is in play and none has opened yet. Phaser
     * pauses a scene at the start of the next frame, so until then it still
     * counts as active; the blur marks an overlay already on its way (losing
     * focus fires both BLUR and HIDDEN, and a second blur would stay after
     * resuming).
     */
    private canOpenOverlay(): boolean {
        return !this.ending && this.scene.isActive() && this.pauseBlur === null;
    }

    private onResume(): void {
        this.removePauseBlur();
        this.sound.resumeAll();
        showCursor(this, false);
    }

    /** The last life is gone: freeze, blur, then show the results. */
    private endRun(): void {
        if (this.ending) {
            return;
        }
        this.ending = true;
        showCursor(this, true);
        // Anything earned with the last life still counts (and its points reach the score).
        this.checkAchievements(false);
        // Saved at once, so closing the tab during the results loses nothing.
        const results = this.saveRun(true);
        // Play slows to a stop as the run ends (stops at once with reduced motion).
        if (prefersReducedMotion()) {
            this.physics.pause();
        } else {
            this.tweens.add({ targets: this.physics.world, timeScale: 6, duration: GAME_OVER_SLOW_MS, ease: 'Quad.In', onComplete: () => this.physics.pause() });
        }
        this.music.stop();
        this.sound.stopAll();
        playSound(this, 'gameOver');
        this.events.emit(RUN_EVENTS.over);

        const blur = this.cameras.main.filters.external.addBlur(1, 2, 2, 0);
        this.tweens.add({ targets: blur, strength: 1.5, duration: 900, ease: 'Sine.Out' });

        let finished = false;
        const finish = (): void => {
            if (finished) {
                return;
            }
            finished = true;
            this.scene.stop('hud');
            this.scene.start('results', results);
        };
        this.time.delayedCall(GAME_OVER_HOLD_MS, finish);
        // Let a key held at the moment of death go before any key can skip.
        this.time.delayedCall(400, () => {
            this.input.keyboard?.once('keydown', finish);
            this.input.once(Phaser.Input.Events.POINTER_DOWN, finish);
        });
    }
}
