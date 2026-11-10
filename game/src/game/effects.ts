// One-off visual effects in the game world: explosions, splats, "+N" points,
// glows and screen shake.
import * as Phaser from 'phaser';
import { ANIMATIONS, firstFrame, type AnimationName } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH, SIZE_SCALE } from '../config';
import { prefersReducedMotion } from '../motion';
import { COLOURS, TEXT_COLOURS, TYPE } from '../theme';
import { UI } from '../ui/kit';
import { addText } from '../ui/text';

/**
 * Shakes the camera. `strength` is the p5 game's shake amount in reference
 * pixels; it decayed by 10% per frame, which this approximates with a steady
 * shake at about half the strength for the same time. Skipped for reduced motion.
 */
export function shake(camera: Phaser.Cameras.Scene2D.Camera, strength: number): void {
    if (prefersReducedMotion()) {
        return;
    }
    const frames = Math.log(0.5 / strength) / Math.log(0.9);
    const pixels = strength * 0.5 * SIZE_SCALE;
    camera.shake((frames * 1000) / 60, new Phaser.Math.Vector2(pixels / DESIGN_WIDTH, pixels / DESIGN_HEIGHT));
}

/** Plays an animation once at (x, y), sized from a box and destroyed when it ends. */
function playOnce(scene: Phaser.Scene, name: AnimationName, x: number, y: number, width: number, height: number): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(x, y, firstFrame(name));
    sprite.setDisplaySize(width, height);
    sprite.play(ANIMATIONS[name]);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    return sprite;
}

/** Fits a size into a square of `size`, keeping the frame's aspect ratio. */
function fit(scene: Phaser.Scene, name: AnimationName, size: number): { width: number; height: number } {
    const frame = scene.textures.getFrame(firstFrame(name));
    const aspect = frame.width / frame.height;
    return aspect >= 1 ? { width: size, height: size / aspect } : { width: size * aspect, height: size };
}

/** A bomb or fireball going off, twice the size of the object. */
export function explode(scene: Phaser.Scene, kind: 'bomb' | 'fireball', x: number, y: number, objectWidth: number, objectHeight: number): Phaser.GameObjects.Sprite {
    const name = kind === 'fireball' ? 'fireballBurst' : 'bombExplosion';
    const { width, height } = fit(scene, name, Math.min(objectWidth, objectHeight) * 2);
    return playOnce(scene, name, x, y, width, height);
}

/** A creature splatting, half as large again as the creature. */
export function splat(scene: Phaser.Scene, x: number, y: number, objectWidth: number): Phaser.GameObjects.Sprite {
    const { width, height } = fit(scene, 'groundSplat', objectWidth * 1.5);
    return playOnce(scene, 'groundSplat', x, y, width, height);
}

/** A Shadow Bolt striking something: a burst the size it was in the p5 game (130 px). */
export function boltHit(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Sprite {
    const { width, height } = fit(scene, 'boltHit', 130 * SIZE_SCALE);
    return playOnce(scene, 'boltHit', x, y, width, height);
}

/** "+N" rising from (x, y) and fading. Big and gold for treasure. */
export function pointsPopup(scene: Phaser.Scene, x: number, y: number, points: number, big: boolean): Phaser.GameObjects.Text {
    const text = addText(scene, x, y, `+${points}`, big ? TYPE.heading : TYPE.body, {
        bold: true,
        colour: big ? TEXT_COLOURS.gold : TEXT_COLOURS.primary,
    }).setOrigin(0.5, 1);
    scene.tweens.add({
        targets: text,
        y: y - (big ? 110 : 80),
        alpha: { from: 1, to: 0 },
        duration: big ? 1000 : 800,
        ease: 'Cubic.Out',
        onComplete: () => text.destroy(),
    });
    return text;
}

/** A soft glow that follows `target` for a second, for treasure as it appears. */
export function spawnGlow(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, colour: number, size: number): Phaser.GameObjects.Image {
    const glow = scene.add.image(target.x, target.y, UI.glow).setTint(colour).setDisplaySize(size, size).setAlpha(0.75);
    scene.tweens.add({
        targets: glow,
        alpha: 0,
        duration: 1000,
        ease: 'Sine.In',
        onUpdate: () => {
            if (target.active) {
                glow.setPosition(target.x, target.y);
            }
        },
        onComplete: () => glow.destroy(),
    });
    return glow;
}

export const GLOW_COLOURS = {
    crown: COLOURS.goldBright,
    diamond: 0x5ad8ff,
} as const;
