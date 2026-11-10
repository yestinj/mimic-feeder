import * as Phaser from 'phaser';
import { TEXTURES, backgroundKey } from '../assets';

/**
 * Draws one of each kind of object the game first uses mid-play (tentacle
 * chains, cooldown sweeps, blurred backdrops), almost invisibly, for a moment
 * on the title screen. Phaser prepares some renderers on first use, and doing
 * that here keeps any one-off cost out of a run.
 */
export function warmUpRenderers(scene: Phaser.Scene): void {
    const chain = scene.add.tileSprite(0, 0, 34, 64, TEXTURES.chain);
    const shapes = scene.add.graphics();
    shapes.fillStyle(0x000000, 1);
    shapes.beginPath();
    shapes.slice(32, 32, 24, 0, Math.PI, false);
    shapes.fillPath();
    shapes.fillGradientStyle(0, 0, 0, 0, 1, 1, 0, 0);
    shapes.fillRect(0, 0, 32, 32);
    const blurred = scene.add.image(0, 0, backgroundKey(0)).setOrigin(0).setScale(0.05);
    blurred.enableFilters();
    blurred.filters?.internal.addBlur(1, 2, 2, 1);

    const objects = [chain, shapes, blurred];
    objects.forEach((object) => object.setAlpha(0.01).setDepth(-1000));
    scene.time.delayedCall(200, () => objects.forEach((object) => object.destroy()));
}
