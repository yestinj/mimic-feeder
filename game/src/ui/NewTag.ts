import * as Phaser from 'phaser';
import { prefersReducedMotion } from '../motion';
import { STRINGS } from '../strings';
import { COLOURS, TEXT_COLOURS, TYPE } from '../theme';
import { addText } from './text';

/** A small gold tag with dark text, centred on (x, y): "New", "Latest". */
export function addTag(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Container {
    const label = addText(scene, 0, 0, text, TYPE.tiny, { bold: true, colour: TEXT_COLOURS.shadow, shadow: false }).setOrigin(0.5);
    const width = label.width + 24;
    const pill = scene.add.graphics()
        .fillStyle(COLOURS.goldBright, 1)
        .fillRoundedRect(-width / 2, -13, width, 26, 13)
        .lineStyle(2, COLOURS.ink, 0.9)
        .strokeRoundedRect(-width / 2, -13, width, 26, 13);
    return scene.add.container(x, y, [pill, label]);
}

/**
 * A "New" tag centred on (x, y), for something earned or met since the
 * player last looked (achievements, How to Play's creatures and items). It
 * pulses gently, unless motion is reduced; the pulse stops with the tag.
 */
export function addNewTag(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const tag = addTag(scene, x, y, STRINGS.newTag);
    if (!prefersReducedMotion()) {
        const pulse = scene.tweens.add({ targets: tag, scale: 1.08, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        tag.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
    }
    return tag;
}
