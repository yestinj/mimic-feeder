import * as Phaser from 'phaser';
import { ANIMATIONS, firstFrame } from '../assets';
import { DESIGN_WIDTH, RUN_SCALE, SIZE_SCALE } from '../config';
import { BOSS, bossHealth, bossSpeedMultiplier, fireballCooldown } from '../rules/boss';
import type { Rng } from '../rules/spawner';

export type BossPhase = 'idle' | 'flying' | 'hit' | 'dying';

/**
 * The Flying Demon (inventory §5): hovers for a second, then flies from side
 * to side firing fireballs straight down. Shadow Bolts hurt it, and while it
 * reels from a hit it neither moves nor fires. Touching it is safe; only its
 * fireballs hurt.
 */
export class Boss extends Phaser.Physics.Arcade.Sprite {
    declare body: Phaser.Physics.Arcade.Body;
    readonly maxHealth: number;
    health: number;
    phase: BossPhase = 'idle';
    private readonly speed: number;
    private direction: 1 | -1 = 1;
    private phaseMs = 0;
    private fireInMs = 0;

    constructor(scene: Phaser.Scene, private readonly floor: number, private readonly rng: Rng) {
        super(scene, DESIGN_WIDTH / 2, BOSS.y * SIZE_SCALE, firstFrame('bossIdle'));
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setAllowGravity(false);
        this.setScale((BOSS.size * SIZE_SCALE) / this.width);
        // The hitbox leaves out the wing tips and the bottom tenth, as in the p5 game.
        this.body.setSize(this.width * BOSS.hitboxWidth, this.height * BOSS.hitboxHeight);
        this.body.setOffset(this.width * (1 - BOSS.hitboxWidth) / 2, 0);
        this.maxHealth = bossHealth(floor);
        this.health = this.maxHealth;
        this.speed = BOSS.speed * RUN_SCALE * bossSpeedMultiplier(floor);
        this.play(ANIMATIONS.bossIdle);
    }

    get alive(): boolean {
        return this.phase !== 'dying';
    }

    /**
     * Moves the boss on by `delta` ms. Calls `fire` with where a fireball
     * starts, and `dead` once its death animation has played out.
     */
    tick(delta: number, fire: (x: number, y: number, speed: number) => void, dead: () => void): void {
        this.phaseMs += delta;
        switch (this.phase) {
            case 'idle':
                if (this.phaseMs >= BOSS.idleMs) {
                    this.enter('flying');
                }
                break;
            case 'flying': {
                const half = this.displayWidth / 2;
                if (this.x - half <= 0) {
                    this.direction = 1;
                } else if (this.x + half >= DESIGN_WIDTH) {
                    this.direction = -1;
                }
                this.setVelocityX(this.direction * this.speed);
                this.setFlipX(this.direction < 0);
                this.fireInMs -= delta;
                if (this.fireInMs <= 0) {
                    fire(this.x, this.y + this.displayHeight / 2, BOSS.fireballSpeed * SIZE_SCALE * bossSpeedMultiplier(this.floor));
                    this.fireInMs = fireballCooldown(this.floor, this.rng);
                }
                break;
            }
            case 'hit':
                break;
            case 'dying':
                if (this.phaseMs >= BOSS.dyingMs) {
                    dead();
                }
                break;
        }
    }

    /** A Shadow Bolt struck it. Returns true if that was the killing blow. */
    hit(): boolean {
        if (!this.alive) {
            return false;
        }
        this.health -= 1;
        this.enter(this.health <= 0 ? 'dying' : 'hit');
        return this.health <= 0;
    }

    private enter(phase: BossPhase): void {
        this.phase = phase;
        this.phaseMs = 0;
        this.setVelocity(0, 0);
        switch (phase) {
            case 'flying':
                this.play(ANIMATIONS.bossFly);
                break;
            case 'hit':
                this.play(ANIMATIONS.bossHit);
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    if (this.phase === 'hit') {
                        this.enter('flying');
                    }
                });
                break;
            case 'dying':
                this.play(ANIMATIONS.bossDie);
                break;
            case 'idle':
                this.play(ANIMATIONS.bossIdle);
                break;
        }
    }
}
