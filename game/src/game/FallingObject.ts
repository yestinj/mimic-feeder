import * as Phaser from 'phaser';
import { ANIMATIONS, OBJECT_ANIMATIONS, objectTexture } from '../assets';
import { SIZE_SCALE } from '../config';
import type { Rect } from '../rules/contact';
import { OBJECTS, type ObjectDef, type ObjectKind } from '../rules/objects';
import { SPAWNING } from '../rules/tuning';

/** Display width of an object, for placing it before it exists. */
export function objectWidth(scene: Phaser.Scene, kind: ObjectKind): number {
    return scene.textures.getFrame(objectTexture(kind)).width * OBJECTS[kind].scale * SIZE_SCALE;
}

/** A creature, shiny or hazard falling from the top of the screen. */
export class FallingObject extends Phaser.Physics.Arcade.Sprite {
    readonly def: ObjectDef;
    /** This object's own speed factor (±25%), kept when the drop speed changes. */
    private readonly variation: number;
    /** Set by Magnetism: the speed it flies at the mimic (5× its fall speed when pulled). */
    magnetSpeed: number | null = null;
    /** Claimed by a tentacle until it's pulled into the mouth: no contact or floor checks. */
    grabbed = false;
    // Both count time in play only (the scene adds each frame's delta), so they stop while the game is paused.
    /** A dragon flying off: how much of its flight is left (ms), or null while it falls. */
    flightLeftMs: number | null = null;
    /** A cat waiting on the floor: how long it has waited (ms), or null until it lands. */
    waitedMs: number | null = null;
    /** A rescued cat, fading out: nothing touches it any more. */
    rescued = false;
    declare body: Phaser.Physics.Arcade.Body;

    constructor(scene: Phaser.Scene, kind: ObjectKind, x: number, variation: number) {
        super(scene, x, SPAWNING.startY * SIZE_SCALE, objectTexture(kind));
        this.def = OBJECTS[kind];
        this.variation = variation;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(this.def.scale * SIZE_SCALE);
        const animation = OBJECT_ANIMATIONS[kind];
        if (animation) {
            this.play(ANIMATIONS[animation]);
        }
        if (kind === 'fireball') {
            // The fireball frames point sideways; turned to fall nose first.
            this.setAngle(90);
        }
    }

    get kind(): ObjectKind {
        return this.def.kind;
    }

    /**
     * True for anything moving down, and for a dragon in flight: the p5 game
     * kept a flying dragon's fall speed, so jumping into one eats it.
     */
    get falling(): boolean {
        return this.body.velocity.y > 0 || this.flightLeftMs !== null;
    }

    /** Sets the fall speed from the current drop speed (design px/s). Magnetised and grabbed objects keep moving their own way. */
    setDropSpeed(dropSpeed: number): void {
        if (this.magnetSpeed === null && !this.grabbed && this.flightLeftMs === null && this.waitedMs === null) {
            this.setVelocity(0, dropSpeed * this.variation * this.def.fallSpeed);
        }
    }

    /** A dragon takes fright: it flies at (vx, vy) for `ms` of play. */
    fly(vx: number, vy: number, ms: number): void {
        this.flightLeftMs = ms;
        this.setVelocity(vx, vy);
    }

    /** A dragon's flight is over: it falls again at the current drop speed. */
    endFlight(dropSpeed: number): void {
        this.flightLeftMs = null;
        this.setDropSpeed(dropSpeed);
    }

    /** A cat lands on the floor at `groundY` and starts its wait there. */
    land(groundY: number): void {
        this.waitedMs = 0;
        this.settle(groundY);
    }

    /** Stops it resting on the floor at `groundY`. */
    settle(groundY: number): void {
        this.setVelocity(0, 0);
        this.y = groundY - this.displayHeight / 2;
    }

    /** Starts flying at the mimic at `multiplier` times its current fall speed, until it's gone. */
    magnetise(multiplier: number): void {
        this.magnetSpeed ??= Math.abs(this.body.velocity.y) * multiplier;
    }

    /** Steers a magnetised object at (x, y). */
    steerTowards(x: number, y: number): void {
        if (this.magnetSpeed === null || this.grabbed) {
            return;
        }
        const direction = new Phaser.Math.Vector2(x - this.x, y - this.y);
        if (direction.lengthSq() > 0) {
            direction.normalize().scale(this.magnetSpeed);
            this.setVelocity(direction.x, direction.y);
        }
    }

    /**
     * A tentacle is reaching for it: it carries on as it was, but nothing
     * touches it and it can't land, until the tentacle reels it in.
     */
    grab(): void {
        this.grabbed = true;
    }

    rect(): Rect {
        return { x: this.body.x, y: this.body.y, width: this.body.width, height: this.body.height };
    }
}
