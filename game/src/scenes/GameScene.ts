import * as Phaser from 'phaser';
import { MUSIC, backgroundKey, floorBackground } from '../assets';
import { MusicPlayer, playSound } from '../audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y, SIZE_SCALE } from '../config';
import { FallingObject, objectWidth } from '../game/FallingObject';
import { Mimic } from '../game/Mimic';
import { GLOW_COLOURS, explode, pointsPopup, shake, spawnGlow, splat } from '../game/effects';
import { expand, overlaps, resolveContact } from '../rules/contact';
import { isCreature, isHazard, isShiny, type ObjectKind } from '../rules/objects';
import { dropSpeed, musicForFloor, spawnInterval } from '../rules/progression';
import { Run, type RunEvent } from '../rules/run';
import { SpawnHistory, keepClearOf, pickObject, pickSpawnX, rollHazard } from '../rules/spawner';
import { MIMIC, SPAWNING } from '../rules/tuning';
import { markReady, setGameView } from '../testHook';
import { onKeyDown } from '../ui/keys';
import { COLOURS, MOTION } from '../theme';
import { GAME_EVENTS } from './SystemScene';

/** Events the game scene emits on its own `events`, for the HUD. */
export const RUN_EVENTS = {
    /** One RunEvent (payload: the event). */
    event: 'run-event',
    /** The run's numbers changed. */
    changed: 'run-changed',
    /** The last life is gone. */
    over: 'run-over',
} as const;

const DEPTH = { background: -10, ground: -9, glow: -1, objects: 0, mimic: 1, effects: 2, popups: 3 } as const;
/** How long the playfield lingers after the last life before the results. */
const GAME_OVER_HOLD_MS = 1800;
const BACKGROUND_FADE_MS = 1200;

const showPhysicsBodies = new URLSearchParams(window.location.search).has('debug');

/** The playfield: the mimic, everything falling, and the run's rules. */
export class GameScene extends Phaser.Scene {
    private run!: Run;
    private mimic!: Mimic;
    private objects!: Phaser.Physics.Arcade.Group;
    private history!: SpawnHistory;
    private music!: MusicPlayer;
    private keys!: Record<'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key>;
    /** [shown, spare]: the spare fades in under the shown one on a new floor. */
    private backgrounds!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
    private shownBackground = '';
    private spawnElapsed = 0;
    private ending = false;
    private pauseBlur: Phaser.Filters.Blur | null = null;
    private readonly random = Math.random;

    constructor() {
        super({ key: 'game', physics: { default: 'arcade', arcade: { debug: showPhysicsBodies } } });
    }

    /** The run in progress, for the HUD and pause screens. */
    get currentRun(): Run {
        return this.run;
    }

    create(): void {
        // The scene object is reused on restart, so reset everything here.
        this.run = new Run();
        this.history = new SpawnHistory(SPAWNING.recentPositions);
        this.spawnElapsed = 0;
        this.ending = false;
        this.pauseBlur = null;
        this.shownBackground = '';

        this.physics.world.setBounds(0, 0, DESIGN_WIDTH, GROUND_Y);
        this.addBackground();
        this.mimic = new Mimic(this, DESIGN_WIDTH / 2);
        this.mimic.sprite.setDepth(DEPTH.mimic);
        this.objects = this.physics.add.group();
        this.physics.add.overlap(this.mimic.hitbox, this.objects, (_mimic, object) => this.touch(object as FallingObject));

        this.setUpInput();
        this.music = new MusicPlayer(this);
        this.music.play(musicForFloor(this.run.floor));

        const onDeferredLoaded = (key: string): void => this.onDeferredLoaded(key);
        this.game.events.on(GAME_EVENTS.deferredLoaded, onDeferredLoaded);
        this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GAME_EVENTS.deferredLoaded, onDeferredLoaded);
            this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
            setGameView(null);
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
            food: this.activeObjects()
                .filter((object) => isCreature(object.kind))
                .map((object) => ({ x: Math.round(object.x), y: Math.round(object.y) }))
                .sort((a, b) => b.y - a.y),
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

        this.spawnElapsed += delta;
        const interval = spawnInterval(this.run.gameLevel);
        if (this.spawnElapsed >= interval) {
            this.spawnElapsed -= interval;
            this.spawn();
        }

        const left = this.keys.left.isDown || this.keys.a.isDown;
        const right = this.keys.right.isDown || this.keys.d.isDown;
        this.mimic.update(Number(right) - Number(left), this.foodNearby(), this.time.now);

        for (const object of this.activeObjects()) {
            if (object.body.bottom >= GROUND_Y) {
                this.land(object);
            }
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
        onKeyDown(this, ['P', 'ESC'], () => this.openPause());
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
        const kind = pickObject(this.random);
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
        // Adding to a physics group resets velocity, so set the speed after.
        this.objects.add(object);
        object.setDropSpeed(this.dropSpeed());
        object.setDepth(DEPTH.objects);
        this.history.add(x);
        if (kind === 'crown' || kind === 'diamond') {
            playSound(this, 'bling');
            spawnGlow(this, object, GLOW_COLOURS[kind], object.displayWidth * 1.8).setDepth(DEPTH.glow);
        }
    }

    /** True when food (not a hazard) is close enough to open the lid. */
    private foodNearby(): boolean {
        const reach = expand(this.mimic.rect(), MIMIC.lidOpenDistance * SIZE_SCALE);
        return this.activeObjects().some((object) => !isHazard(object.kind) && overlaps(reach, object.rect()));
    }

    /** Something touched the mimic: eaten, bumped, collected or set off. */
    private touch(object: FallingObject): void {
        if (this.ending || !object.active) {
            return;
        }
        const kind = object.kind;
        let events: RunEvent[] = [];
        switch (resolveContact(object.def.category, object.rect(), this.mimic.rect(), object.falling)) {
            case 'eat':
                if (isCreature(kind)) {
                    events = this.run.eat(kind);
                }
                playSound(this, 'collect');
                break;
            case 'collect':
                if (isShiny(kind)) {
                    events = this.run.collect(kind);
                }
                playSound(this, 'collect');
                shake(this.cameras.main, 4);
                break;
            case 'bump':
                events = this.run.bump();
                splat(this, object.x, object.y, object.displayWidth).setDepth(DEPTH.effects);
                playSound(this, 'splat');
                break;
            case 'detonate':
                if (isHazard(kind)) {
                    events = this.run.detonate(kind);
                    explode(this, kind, object.x, object.y, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
                }
                playSound(this, 'explode');
                shake(this.cameras.main, 5);
                break;
        }
        object.destroy();
        this.apply(events, isShiny(kind));
    }

    /** Something reached the floor. */
    private land(object: FallingObject): void {
        const kind = object.kind;
        let events: RunEvent[] = [];
        if (isCreature(kind)) {
            events = this.run.miss();
            splat(this, object.x, GROUND_Y, object.displayWidth).setDepth(DEPTH.effects);
            playSound(this, 'splat');
        } else if (isShiny(kind)) {
            playSound(this, 'glassBreak');
        } else if (isHazard(kind)) {
            explode(this, kind, object.x, GROUND_Y - object.displayHeight / 2, object.displayWidth, object.displayHeight).setDepth(DEPTH.effects);
            playSound(this, 'explode');
        }
        object.destroy();
        this.apply(events, false);
    }

    /** Plays and shows what the run's rules reported, then tells the HUD. */
    private apply(events: readonly RunEvent[], treasure: boolean): void {
        for (const event of events) {
            switch (event.type) {
                case 'points':
                    pointsPopup(this, this.mimic.centerX, this.mimic.top - 8, event.points, treasure).setDepth(DEPTH.popups);
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
                        this.music.play(musicForFloor(event.floor));
                    }
                    break;
                case 'extraLife':
                    playSound(this, 'playerLevelUp');
                    break;
                case 'lifeLost':
                    playSound(this, 'loseLife');
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
        this.showFloorBackground(true);

        // A soft shadow along the floor, so things land on something.
        const ground = this.add.graphics().setDepth(DEPTH.ground);
        ground.fillGradientStyle(COLOURS.ink, COLOURS.ink, COLOURS.ink, COLOURS.ink, 0, 0, 0.55, 0.55);
        ground.fillRect(0, GROUND_Y - 40, DESIGN_WIDTH, DESIGN_HEIGHT - GROUND_Y + 40);
    }

    private showFloorBackground(instant: boolean): void {
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

    private openPause(): void {
        if (this.ending || !this.scene.isActive()) {
            return;
        }
        this.pauseBlur = this.cameras.main.filters.external.addBlur(1, 2, 2, 1);
        this.sound.pauseAll();
        this.scene.pause();
        this.scene.pause('hud');
        this.scene.launch('pause');
    }

    private onResume(): void {
        if (this.pauseBlur) {
            this.cameras.main.filters.external.remove(this.pauseBlur);
            this.pauseBlur = null;
        }
        this.sound.resumeAll();
    }

    /** The last life is gone: freeze, blur, then show the results. */
    private endRun(): void {
        if (this.ending) {
            return;
        }
        this.ending = true;
        this.physics.pause();
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
            this.scene.start('results', this.run.summary());
        };
        this.time.delayedCall(GAME_OVER_HOLD_MS, finish);
        // Let a key held at the moment of death go before any key can skip.
        this.time.delayedCall(400, () => {
            this.input.keyboard?.once('keydown', finish);
            this.input.once(Phaser.Input.Events.POINTER_DOWN, finish);
        });
    }
}
