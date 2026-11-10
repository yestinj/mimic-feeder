import * as Phaser from 'phaser';
import { TEXT_COLOURS, TYPE } from '../theme';
import { SLICE, UI } from './kit';
import { addText } from './text';

/** A keyboard key graphic, e.g. new Keycap(scene, x, y, 'Space'). Widens to fit its label. */
export class Keycap extends Phaser.GameObjects.Container {
    constructor(scene: Phaser.Scene, x: number, y: number, label: string, size = 48) {
        super(scene, x, y);
        const fontSize = Math.round(size * (label.length > 1 ? 0.42 : 0.5));
        const text = addText(scene, 0, -size * 0.05, label, Math.max(fontSize, TYPE.tiny - 4), {
            bold: true,
            colour: TEXT_COLOURS.primary,
            shadow: false,
        }).setOrigin(0.5);
        const width = Math.max(size, Math.ceil(text.width + size * 0.6));
        const cap = scene.add.nineslice(0, 0, UI.keycap, undefined, width, size, SLICE.keycap, SLICE.keycap, SLICE.keycap, SLICE.keycap);
        this.add([cap, text]);
        this.setSize(width, size);
        scene.add.existing(this);
    }
}
