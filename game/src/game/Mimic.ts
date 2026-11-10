import * as Phaser from 'phaser';
import { TEXTURES } from '../assets';
import { GROUND_Y, RUN_SCALE, SIZE_SCALE } from '../config';
import type { Rect } from '../rules/contact';
import type { Growth } from '../rules/run';
import { MIMIC } from '../rules/tuning';

export type Lid = 'closed' | 'ajar' | 'open';

const LID_TEXTURES: Record<Lid, string> = {
    closed: TEXTURES.chestClosed,
    ajar: TEXTURES.chestAjar,
    open: TEXTURES.chestOpen,
};

/**
 * The player's chest. Its hitbox is an invisible physics zone the size of the
 * closed chest; the sprite follows it, standing on the hitbox's bottom edge,
 * so the open lid can rise above it without changing what counts as a hit.
 */
export class Mimic {
    readonly sprite: Phaser.GameObjects.Image;
    private readonly zone: Phaser.GameObjects.Zone;
    private readonly body: Phaser.Physics.Arcade.Body;
    private readonly baseWidth: number;
    private readonly baseHeight: number;
    private growth: Growth = { speed: 1, size: 1, jump: 1 };
    private jumps = 0;
    /** Scene time until which the lid stays open after reaching for food mid-jump. */
    private biteOpenUntil = 0;
    /** Scene time until which the lid is held open (tentacles) or ajar (just cast a Shadow Bolt). */
    private holdOpenUntil = 0;
    private holdAjarUntil = 0;
    lid: Lid = 'closed';

    constructor(scene: Phaser.Scene, x: number) {
        const closed = scene.textures.getFrame(TEXTURES.chestClosed);
        this.baseWidth = closed.width * MIMIC.scale * SIZE_SCALE;
        this.baseHeight = closed.height * MIMIC.scale * SIZE_SCALE;

        this.zone = scene.add.zone(x, GROUND_Y - this.baseHeight / 2, this.baseWidth, this.baseHeight);
        scene.physics.add.existing(this.zone);
        this.body = this.zone.body as Phaser.Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setGravityY(MIMIC.gravity * SIZE_SCALE);

        this.sprite = scene.add.image(x, GROUND_Y, TEXTURES.chestClosed).setOrigin(0.5, 1);
        this.applyGrowth(this.growth);
    }

    /** The physics zone, for overlap checks. */
    get hitbox(): Phaser.GameObjects.Zone {
        return this.zone;
    }

    get centerX(): number {
        return this.body.center.x;
    }

    get centerY(): number {
        return this.body.center.y;
    }

    get top(): number {
        return this.body.top;
    }

    /** Where food goes in: the middle of the mouth. */
    get mouth(): { x: number; y: number } {
        return { x: this.body.center.x, y: this.body.top + this.body.height * 0.15 };
    }

    get onGround(): boolean {
        return this.body.blocked.down && this.body.velocity.y >= 0;
    }

    rect(): Rect {
        return { x: this.body.x, y: this.body.y, width: this.body.width, height: this.body.height };
    }

    /** Resizes and re-tunes the mimic for its level. */
    applyGrowth(growth: Growth): void {
        this.growth = growth;
        const width = this.baseWidth * growth.size;
        const height = this.baseHeight * growth.size;
        const bottom = this.body.bottom;
        this.zone.setSize(width, height);
        this.body.setSize(width, height, true);
        // Keep standing on the same spot rather than growing into the floor.
        this.body.y = bottom - height;
        this.zone.y = bottom - height / 2;
        this.sprite.setScale(MIMIC.scale * SIZE_SCALE * growth.size);
    }

    /** Holds the lid open until `time` (scene time). */
    holdOpen(time: number): void {
        this.holdOpenUntil = Math.max(this.holdOpenUntil, time);
    }

    /** Holds the lid ajar until `time` (scene time). */
    holdAjar(time: number): void {
        this.holdAjarUntil = Math.max(this.holdAjarUntil, time);
    }

    /** Moves instantly by `distance` (negative is left), stopping at the screen edges. */
    dash(distance: number): void {
        const half = this.body.width / 2;
        const bounds = this.body.world.bounds;
        this.zone.x = Phaser.Math.Clamp(this.zone.x + distance, bounds.left + half, bounds.right - half);
        this.sprite.x = this.zone.x;
    }

    /** Jumps if it can; returns which jump it was (1 or 2), or 0 if it couldn't. */
    jump(): number {
        if (this.jumps >= MIMIC.maxJumps) {
            return 0;
        }
        this.jumps += 1;
        this.body.setVelocityY(-MIMIC.jumpSpeed * SIZE_SCALE * this.growth.jump);
        return this.jumps;
    }

    /**
     * Moves in `direction` (-1, 0 or 1) and picks the lid, in the p5 game's
     * order: held open (tentacles), open for a moment after reaching for food
     * mid-jump, ajar just after casting, open when food is close, ajar while
     * moving or in the air, closed otherwise.
     */
    update(direction: number, foodNearby: boolean, time: number): void {
        this.body.setVelocityX(direction * MIMIC.runSpeed * RUN_SCALE * this.growth.speed);
        if (this.onGround) {
            this.jumps = 0;
        }

        const airborne = !this.onGround;
        if (time < this.holdOpenUntil || time < this.biteOpenUntil) {
            this.lid = 'open';
        } else if (time < this.holdAjarUntil) {
            this.lid = 'ajar';
        } else if (foodNearby) {
            this.lid = 'open';
            if (airborne) {
                this.biteOpenUntil = time + MIMIC.jumpBiteOpenTime * 1000;
            }
        } else if (airborne || direction !== 0) {
            this.lid = 'ajar';
        } else {
            this.lid = 'closed';
        }
        this.sprite.setTexture(LID_TEXTURES[this.lid]);
        this.sprite.setPosition(this.body.center.x, this.body.bottom);
    }
}
