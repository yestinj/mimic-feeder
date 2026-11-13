// The rows of a settings list: a label on the left and a control on the
// right (slider, toggle, name field), or a label alone for an action. Rows
// are focused and changed through a Menu, or with the mouse.
import * as Phaser from 'phaser';
import { playSound } from '../audio';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import type { Focusable } from './Menu';
import { TextField, type TextFieldOptions } from './TextField';
import { addText } from './text';
import { POINTER_CURSOR } from './cursor';

export const ROW_HEIGHT = 60;
const INSET = 20;

export interface RowOptions {
    /** Red label, for actions that destroy something. */
    readonly danger?: boolean;
}

/** A focusable row: highlight, label, and room on the right for a control. */
abstract class Row extends Phaser.GameObjects.Container implements Focusable {
    onHover: (() => void) | null = null;
    protected focused = false;
    protected readonly label: Phaser.GameObjects.Text;
    private readonly highlight: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, x: number, y: number, protected readonly rowWidth: number, text: string, private readonly rowOptions: RowOptions = {}) {
        super(scene, x, y);
        this.highlight = scene.add.graphics();
        this.label = addText(scene, -rowWidth / 2 + INSET, 0, text, TYPE.body, { bold: true }).setOrigin(0, 0.5);
        this.add([this.highlight, this.label]);
        this.setSize(rowWidth, ROW_HEIGHT);
        this.setInteractive({ cursor: POINTER_CURSOR });
        this.on(Phaser.Input.Events.POINTER_OVER, () => this.onHover?.());
        scene.add.existing(this);
        this.paintRow();
    }

    /** True if the pointer was pressed down on this row (so a release over it, or a drag, belongs to it). */
    protected pressedHere(pointer: Phaser.Input.Pointer): boolean {
        return Math.abs(pointer.downX - this.x) <= this.rowWidth / 2 && Math.abs(pointer.downY - this.y) <= ROW_HEIGHT / 2;
    }

    /** Runs `action` on a click: pressed and released on this row. */
    protected onClick(action: () => void): void {
        this.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
            if (this.pressedHere(pointer)) {
                action();
            }
        });
    }

    /** The control's right edge, in the row's own coordinates. */
    protected get right(): number {
        return this.rowWidth / 2 - INSET;
    }

    isEnabled(): boolean {
        return true;
    }

    setFocused(focused: boolean): this {
        this.focused = focused;
        this.paintRow();
        return this;
    }

    abstract select(event?: KeyboardEvent): void;

    /** A short flash, so a selection is seen to land. */
    protected flash(): void {
        this.scene.tweens.add({ targets: this.highlight, alpha: { from: 0.4, to: 1 }, duration: MOTION.normal, ease: MOTION.ease });
    }

    private paintRow(): void {
        const w = this.rowWidth;
        this.highlight.clear();
        if (this.focused) {
            this.highlight
                .fillStyle(COLOURS.stoneLight, 0.95)
                .fillRoundedRect(-w / 2, -ROW_HEIGHT / 2, w, ROW_HEIGHT, 12)
                .lineStyle(2, COLOURS.gold, 0.9)
                .strokeRoundedRect(-w / 2, -ROW_HEIGHT / 2, w, ROW_HEIGHT, 12);
        }
        const colour = this.rowOptions.danger ? TEXT_COLOURS.danger : this.focused ? TEXT_COLOURS.gold : TEXT_COLOURS.primary;
        this.label.setColor(colour);
    }
}

const TRACK_WIDTH = 280;
const TRACK_HEIGHT = 10;
const KNOB_RADIUS = 14;
const VALUE_WIDTH = 100;

/** A 0–100% slider in steps of 10%: ←/→ or a click or drag on the track. */
export class SliderRow extends Row {
    private value: number;
    private readonly track: Phaser.GameObjects.Graphics;
    private readonly valueText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, text: string, value: number, private readonly onChange: (value: number) => void) {
        super(scene, x, y, width, text);
        this.value = value;
        this.track = scene.add.graphics();
        this.valueText = addText(scene, this.right, 0, '', TYPE.body, { bold: true }).setOrigin(1, 0.5);
        this.add([this.track, this.valueText]);
        const fromPointer = (pointer: Phaser.Input.Pointer): void => {
            if (pointer.isDown && this.pressedHere(pointer)) {
                this.setFromX(pointer.x - this.x);
            }
        };
        this.on(Phaser.Input.Events.POINTER_DOWN, fromPointer);
        this.on(Phaser.Input.Events.POINTER_MOVE, fromPointer);
        this.paint();
    }

    get current(): number {
        return this.value;
    }

    select(): void {
        // Enter does nothing on a slider; ←/→ change it.
    }

    adjust(step: 1 | -1): void {
        this.change(this.value + step * 0.1);
    }

    setValue(value: number): void {
        this.value = value;
        this.paint();
    }

    private get trackLeft(): number {
        return this.right - VALUE_WIDTH - TRACK_WIDTH;
    }

    private setFromX(localX: number): void {
        // Clicks a little past either end still reach 0% and 100%.
        const ratio = (localX - this.trackLeft) / TRACK_WIDTH;
        if (ratio >= -0.1 && ratio <= 1.1) {
            this.change(ratio);
        }
    }

    private change(value: number): void {
        const stepped = Phaser.Math.Clamp(Math.round(value * 10) / 10, 0, 1);
        if (stepped !== this.value) {
            this.value = stepped;
            this.paint();
            this.onChange(stepped);
            // After the change, so the effects volume ticks at its new level.
            playSound(this.scene, 'uiTick');
        }
    }

    private paint(): void {
        const left = this.trackLeft;
        const filled = TRACK_WIDTH * this.value;
        this.track.clear()
            .fillStyle(COLOURS.iron, 1)
            .fillRoundedRect(left, -TRACK_HEIGHT / 2, TRACK_WIDTH, TRACK_HEIGHT, TRACK_HEIGHT / 2)
            .fillStyle(COLOURS.gold, 1)
            .fillRoundedRect(left, -TRACK_HEIGHT / 2, Math.max(filled, TRACK_HEIGHT), TRACK_HEIGHT, TRACK_HEIGHT / 2)
            .fillStyle(COLOURS.goldBright, 1)
            .fillCircle(left + filled, 0, KNOB_RADIUS)
            .lineStyle(3, COLOURS.ink, 0.8)
            .strokeCircle(left + filled, 0, KNOB_RADIUS);
        this.valueText.setText(`${Math.round(this.value * 100)}%`);
    }
}

const SWITCH_WIDTH = 88;
const SWITCH_HEIGHT = 40;

/** An on/off switch: Enter, ←/→ or a click flip it. */
export class ToggleRow extends Row {
    private value: boolean;
    private readonly switchArt: Phaser.GameObjects.Graphics;
    private readonly stateText: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        text: string,
        value: boolean,
        private readonly labels: { readonly on: string; readonly off: string },
        private readonly onChange: (value: boolean) => void,
    ) {
        super(scene, x, y, width, text);
        this.value = value;
        this.switchArt = scene.add.graphics();
        this.stateText = addText(scene, this.right - SWITCH_WIDTH - 18, 0, '', TYPE.body, { bold: true }).setOrigin(1, 0.5);
        this.add([this.switchArt, this.stateText]);
        this.onClick(() => this.select());
        this.paint();
    }

    get current(): boolean {
        return this.value;
    }

    select(): void {
        this.value = !this.value;
        this.paint();
        this.onChange(this.value);
        // After the change: muting is silent, unmuting clicks.
        playSound(this.scene, 'uiToggle');
    }

    adjust(): void {
        this.select();
    }

    /** Shows a value changed elsewhere (M for mute, the browser leaving fullscreen). */
    setValue(value: boolean): void {
        this.value = value;
        this.paint();
    }

    private paint(): void {
        const left = this.right - SWITCH_WIDTH;
        const radius = SWITCH_HEIGHT / 2;
        this.switchArt.clear()
            .fillStyle(this.value ? COLOURS.gold : COLOURS.iron, 1)
            .fillRoundedRect(left, -radius, SWITCH_WIDTH, SWITCH_HEIGHT, radius)
            .fillStyle(this.value ? COLOURS.goldBright : COLOURS.stoneLight, 1)
            .fillCircle(this.value ? this.right - radius : left + radius, 0, radius - 5);
        this.stateText.setText(this.value ? this.labels.on : this.labels.off);
        this.stateText.setColor(this.value ? TEXT_COLOURS.gold : TEXT_COLOURS.muted);
    }
}

/** A label that does something when selected (Reset settings, Erase save data). */
export class ActionRow extends Row {
    constructor(scene: Phaser.Scene, x: number, y: number, width: number, text: string, private readonly action: () => void, options: RowOptions = {}) {
        super(scene, x, y, width, text, options);
        this.add(addText(scene, this.right, 0, '›', TYPE.heading, { bold: true, colour: TEXT_COLOURS.muted }).setOrigin(1, 0.55));
        this.onClick(() => this.select());
    }

    select(): void {
        this.flash();
        playSound(this.scene, 'uiSelect');
        this.action();
    }
}

const FIELD_WIDTH = 330;

/** A name: Enter (or a click) starts typing, Enter saves, Esc puts the old name back. */
export class TextRow extends Row {
    readonly field: TextField;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, text: string, value: string, field: Omit<TextFieldOptions, 'width'>, private readonly onDone: (value: string) => void) {
        super(scene, x, y, width, text);
        this.field = new TextField(scene, 0, 0, value, { ...field, width: FIELD_WIDTH });
        this.field.x = this.right - FIELD_WIDTH / 2;
        this.add(this.field);
        this.onClick(() => {
            if (!this.field.isEditing) {
                this.select();
            }
        });
    }

    get capturing(): boolean {
        return this.field.isEditing;
    }

    select(event?: KeyboardEvent): void {
        if (this.field.isEditing) {
            this.onDone(this.field.finish());
        } else {
            this.field.startEditing(event?.timeStamp);
        }
    }

    /** Esc while typing. */
    cancel(): void {
        this.field.cancel();
    }
}
