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
    /** Held by a tentacle and being pulled into the mouth: no contact or floor checks. */
    grabbed = false;
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

    get falling(): boolean {
        return this.body.velocity.y > 0;
    }

    /** Sets the fall speed from the current drop speed (design px/s). Magnetised and grabbed objects keep moving their own way. */
    setDropSpeed(dropSpeed: number): void {
        if (this.magnetSpeed === null && !this.grabbed) {
            this.setVelocityY(dropSpeed * this.variation * this.def.fallSpeed);
        }
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

    /** A tentacle has it: it stops falling and is moved by the tentacle. */
    grab(): void {
        this.grabbed = true;
        this.setVelocity(0, 0);
    }

    rect(): Rect {
        return { x: this.body.x, y: this.body.y, width: this.body.width, height: this.body.height };
    }
}
