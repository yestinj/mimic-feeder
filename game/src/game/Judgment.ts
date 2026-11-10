import * as Phaser from 'phaser';
import { ANIMATIONS, TEXTURES, firstFrame } from '../assets';
import { playSound } from '../audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y, RUN_SCALE, SIZE_SCALE } from '../config';
import { prefersReducedMotion } from '../motion';
import { overlaps, type Rect } from '../rules/contact';
import { JUDGMENT, nextGapCentre, waveFireballs, waveSpeed } from '../rules/judgment';
import type { Rng } from '../rules/spawner';
import { explode, shake } from './effects';

export type JudgmentPhase = 'summoning' | 'attack' | 'ending';

/** What the HUD shows: the phase, and during the attack which wave of how many. */
export interface JudgmentView {
    readonly phase: JudgmentPhase;
    readonly wave: number;
    readonly waves: number;
}

export interface JudgmentHooks {
    /** The mimic's hitbox, centre and width, and how far it can run while a wall falls. */
    mimic(): { rect: Rect; centreX: number; width: number; reach: number };
    /** A fireball hit the mimic (at most once per grace period): it costs a life. */
    hit(): void;
    /** The phase or wave changed. */
    changed(view: JudgmentView): void;
    /** The apparition has gone: the judgment is over. */
    done(): void;
}

interface Fireball {
    readonly sprite: Phaser.GameObjects.Sprite;
    readonly speed: number;
    delayMs: number;
}

const FIREBALL_SIZE = JUDGMENT.fireballSize * SIZE_SCALE;
/** Explosion sounds at most this often, however many fireballs land at once. */
const IMPACT_SOUND_MS = (8 * 1000) / 60;
/** The apparition's slow bob: 5 px at the p5 game's 0.035 radians per frame. */
const BOB_PX = 5 * SIZE_SCALE;
const BOB_RATE = (0.035 * 60) / 1000;

/**
 * The Ninefold Judgment, once it has begun: a purple shade and the
 * apparition gather (summoning), then nine walls of fire fall, each with one
 * gap (attack), then the apparition fades (ending). The scene suspends
 * everything else meanwhile and restores it when `done` is called.
 */
export class Judgment {
    phase: JudgmentPhase = 'summoning';
    private phaseMs = 0;
    private waveTimerMs = 0;
    private wavesReleased = 0;
    private gapCentre: number | null = null;
    private damageCooldownMs = 0;
    private impactSoundMs = 0;
    private elapsedMs = 0;
    private fireballs: Fireball[] = [];
    private readonly shade: Phaser.GameObjects.Rectangle;
    private readonly apparition: Phaser.GameObjects.Image | null;
    private readonly apparitionY: number;
    private readonly fireballDepth: number;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly hooks: JudgmentHooks,
        private readonly rng: Rng,
        depths: { shade: number; apparition: number; fireballs: number },
    ) {
        this.shade = scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0x120016, 105 / 255).setOrigin(0).setDepth(depths.shade);
        // The apparition loads in the background; without it, the shade alone has to do.
        if (scene.textures.exists(TEXTURES.apparition)) {
            const image = scene.add.image(DESIGN_WIDTH / 2, 0, TEXTURES.apparition).setOrigin(0.5, 0).setDepth(depths.apparition).setAlpha(0);
            image.setScale(Math.min((DESIGN_WIDTH * 0.84) / image.width, (DESIGN_HEIGHT * 0.74) / image.height));
            this.apparition = image;
        } else {
            this.apparition = null;
        }
        this.apparitionY = DESIGN_HEIGHT * 0.045;
        this.fireballDepth = depths.fireballs;
        shake(scene.cameras.main, 10);
        this.hooks.changed(this.view());
    }

    /** Where the current gap is centred (null before the first wave). */
    get gap(): number | null {
        return this.gapCentre;
    }

    /** The wave the HUD shows: the one falling, or the one about to. */
    private view(): JudgmentView {
        const wave = this.fireballs.length > 0 ? this.wavesReleased : Math.min(JUDGMENT.waves, this.wavesReleased + 1);
        return { phase: this.phase, wave, waves: JUDGMENT.waves };
    }

    update(delta: number): void {
        this.elapsedMs += delta;
        this.phaseMs += delta;
        this.damageCooldownMs = Math.max(0, this.damageCooldownMs - delta);
        this.impactSoundMs = Math.max(0, this.impactSoundMs - delta);
        switch (this.phase) {
            case 'summoning':
                this.setApparitionAlpha((235 / 255) * Math.min(1, (this.phaseMs / JUDGMENT.summonMs) * 1.8));
                if (this.phaseMs >= JUDGMENT.summonMs) {
                    this.startAttack();
                }
                break;
            case 'attack':
                this.updateAttack(delta);
                break;
            case 'ending':
                this.setApparitionAlpha((150 / 255) * (1 - Math.min(1, this.phaseMs / JUDGMENT.endMs)));
                if (this.phaseMs >= JUDGMENT.endMs) {
                    this.hooks.done();
                }
                break;
        }
        if (this.apparition) {
            const bob = prefersReducedMotion() ? 0 : Math.sin(this.elapsedMs * BOB_RATE) * BOB_PX;
            this.apparition.y = this.apparitionY + bob;
        }
    }

    destroy(): void {
        this.fireballs.forEach((fireball) => fireball.sprite.destroy());
        this.fireballs = [];
        this.shade.destroy();
        this.apparition?.destroy();
    }

    private setApparitionAlpha(alpha: number): void {
        this.apparition?.setAlpha(alpha);
    }

    private startAttack(): void {
        this.phase = 'attack';
        this.phaseMs = 0;
        this.waveTimerMs = JUDGMENT.firstWaveDelayMs;
        this.gapCentre = this.nextGap(null);
        this.shade.setFillStyle(0x120016, 52 / 255);
        this.setApparitionAlpha(105 / 255);
        this.hooks.changed(this.view());
    }

    private nextGap(current: number | null): number {
        const mimic = this.hooks.mimic();
        const field = { width: DESIGN_WIDTH, gap: this.gapWidth(), margin: JUDGMENT.edgeMargin * SIZE_SCALE };
        return nextGapCentre(current, mimic.centreX, mimic.reach, field, this.rng);
    }

    /** The mimic's width plus a little room to line up (scaled like running): the only way through. */
    private gapWidth(): number {
        return Math.min(DESIGN_WIDTH - 12 * SIZE_SCALE, this.hooks.mimic().width + JUDGMENT.gapPadding * RUN_SCALE);
    }

    private updateAttack(delta: number): void {
        if (this.fireballs.length === 0 && this.wavesReleased < JUDGMENT.waves && this.waveTimerMs > 0) {
            this.waveTimerMs -= delta;
            if (this.waveTimerMs <= 0) {
                this.releaseWave();
            }
        }
        this.updateFireballs(delta);
        // The next gap is only decided once this wall has completely passed, so waves never combine.
        if (this.fireballs.length === 0 && this.waveTimerMs <= 0) {
            if (this.wavesReleased >= JUDGMENT.waves) {
                this.phase = 'ending';
                this.phaseMs = 0;
                this.hooks.changed(this.view());
            } else {
                this.gapCentre = this.nextGap(this.gapCentre);
                this.waveTimerMs = JUDGMENT.waveIntervalMs;
                this.hooks.changed(this.view());
            }
        }
    }

    private releaseWave(): void {
        const wave = this.wavesReleased;
        const speed = waveSpeed(wave) * SIZE_SCALE;
        const [trailingMin, trailingMax] = JUDGMENT.trailingSpread;
        const shape = {
            fieldWidth: DESIGN_WIDTH,
            gapCentre: this.gapCentre ?? DESIGN_WIDTH / 2,
            gap: this.gapWidth(),
            size: FIREBALL_SIZE,
            spread: JUDGMENT.spread * SIZE_SCALE,
            trailing: [trailingMin * SIZE_SCALE, trailingMax * SIZE_SCALE] as const,
        };
        for (const { x, above, delayMs } of waveFireballs(wave, shape, this.rng)) {
            const sprite = this.scene.add.sprite(x, FIREBALL_SIZE / 2 - above, firstFrame('fireball'))
                .setDisplaySize(FIREBALL_SIZE, FIREBALL_SIZE)
                .setAngle(90)
                .setDepth(this.fireballDepth)
                .setVisible(delayMs <= 0);
            sprite.play({ key: ANIMATIONS.fireball, startFrame: wave % 30 });
            this.fireballs.push({ sprite, speed, delayMs });
        }
        this.wavesReleased += 1;
        this.waveTimerMs = 0;
        shake(this.scene.cameras.main, 4);
        this.hooks.changed(this.view());
    }

    private updateFireballs(delta: number): void {
        const mimic = this.hooks.mimic().rect;
        const half = FIREBALL_SIZE / 2;
        this.fireballs = this.fireballs.filter((fireball) => {
            const { sprite } = fireball;
            if (fireball.delayMs > 0) {
                fireball.delayMs -= delta;
                sprite.setVisible(fireball.delayMs <= 0);
                return true;
            }
            sprite.y += (fireball.speed * delta) / 1000;
            const rect = { x: sprite.x - half, y: sprite.y - half, width: FIREBALL_SIZE, height: FIREBALL_SIZE };
            if (overlaps(rect, mimic)) {
                // Overlapping fireballs only cost one life between them.
                if (this.damageCooldownMs <= 0) {
                    this.damageCooldownMs = JUDGMENT.damageCooldownMs;
                    shake(this.scene.cameras.main, 9);
                    this.hooks.hit();
                }
                this.impact(sprite.x, sprite.y);
                sprite.destroy();
                return false;
            }
            if (sprite.y + half >= GROUND_Y) {
                this.impact(sprite.x, GROUND_Y - half);
                sprite.destroy();
                return false;
            }
            return true;
        });
    }

    private impact(x: number, y: number): void {
        explode(this.scene, 'fireball', x, y, FIREBALL_SIZE, FIREBALL_SIZE).setDepth(this.fireballDepth + 0.1);
        if (this.impactSoundMs <= 0) {
            playSound(this.scene, 'explode');
            this.impactSoundMs = IMPACT_SOUND_MS;
        }
        shake(this.scene.cameras.main, 3);
    }
}
