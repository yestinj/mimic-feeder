import * as Phaser from 'phaser';
import { ANIMATIONS, OBJECT_ANIMATIONS, firstFrame, objectTexture } from '../assets';
import type { GuideKey } from '../rules/guide';
import { UI } from './kit';

/** Sprites with a lot of empty space round them, drawn larger to fill their space like the rest. */
const ZOOM: Partial<Record<GuideKey, number>> = { boss: 1.9, fireball: 1.6 };
/** The Staff and Magnet sprites are square tiles, which don't sit well on their own: their kit icons stand in. */
const KIT_PICTURES: Partial<Record<GuideKey, string>> = { staff: UI.iconStaff, magnet: UI.iconMagnetism };

/**
 * A creature, item or the boss as it looks in play (animated, if it moves),
 * centred on (x, y) and fitted to a `size` square. With `silhouette`, a dark
 * shape of it instead (something not met yet).
 */
export function addEntrySprite(scene: Phaser.Scene, x: number, y: number, key: GuideKey, size: number, silhouette = false): Phaser.GameObjects.Sprite {
    const sprite = entrySprite(scene, x, y, key);
    fitTo(sprite, size * (ZOOM[key] ?? 1));
    if (silhouette) {
        sprite.setTint(0x5c4f44).setTintMode(Phaser.TintModes.FILL);
    }
    return sprite;
}

/** Scales an image or sprite to fit a `size` square. */
export function fitTo<T extends Phaser.GameObjects.Image>(image: T, size: number): T {
    image.setScale(Math.min(size / image.width, size / image.height));
    return image;
}

function entrySprite(scene: Phaser.Scene, x: number, y: number, key: GuideKey): Phaser.GameObjects.Sprite {
    const kit = KIT_PICTURES[key];
    if (kit) {
        return scene.add.sprite(x, y, kit);
    }
    if (key === 'boss') {
        return scene.add.sprite(x, y, firstFrame('bossIdle')).play(ANIMATIONS.bossIdle);
    }
    const sprite = scene.add.sprite(x, y, objectTexture(key));
    const animation = OBJECT_ANIMATIONS[key];
    if (animation) {
        sprite.play(ANIMATIONS[animation]);
    }
    if (key === 'fireball') {
        // The fireball frames point sideways; turned to fall nose first, as in play.
        sprite.setAngle(90);
    }
    return sprite;
}
