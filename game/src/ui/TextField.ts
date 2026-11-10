import * as Phaser from 'phaser';
import { COLOURS, TEXT_COLOURS, TYPE } from '../theme';
import { setTyping } from './keys';
import { addText } from './text';

export interface TextFieldOptions {
    readonly width: number;
    readonly maxLength: number;
    /** Shown dimmed while the field is empty. */
    readonly placeholder: string;
    /** Characters that can be typed (one at a time). */
    readonly allowed: RegExp;
}

const HEIGHT = 48;
const PADDING = 16;

/**
 * A one-line text box for names. While editing it takes typed characters and
 * Backspace; whoever owns it decides what Enter and Esc do (finish() and
 * cancel()), so a menu's Enter can't both finish and restart an edit.
 */
export class TextField extends Phaser.GameObjects.Container {
    private value: string;
    private valueBefore: string;
    private editing = false;
    /** Key presses from before editing started are not typing. */
    private since = 0;
    private readonly seen = new WeakSet<KeyboardEvent>();
    private readonly box: Phaser.GameObjects.Graphics;
    private readonly text: Phaser.GameObjects.Text;
    private readonly caret: Phaser.GameObjects.Rectangle;
    private readonly caretBlink: Phaser.Tweens.Tween;

    constructor(scene: Phaser.Scene, x: number, y: number, value: string, private readonly options: TextFieldOptions) {
        super(scene, x, y);
        this.value = value;
        this.valueBefore = value;
        this.box = scene.add.graphics();
        this.text = addText(scene, -options.width / 2 + PADDING, 0, '', TYPE.body, { bold: true }).setOrigin(0, 0.5);
        this.caret = scene.add.rectangle(0, 0, 3, 30, COLOURS.goldBright).setVisible(false);
        this.add([this.box, this.text, this.caret]);
        this.setSize(options.width, HEIGHT);
        this.caretBlink = scene.tweens.add({ targets: this.caret, alpha: 0, duration: 420, yoyo: true, repeat: -1, paused: true });

        const keyboard = scene.input.keyboard;
        keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey);
        this.once(Phaser.GameObjects.Events.DESTROY, () => {
            keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey);
            if (this.editing) {
                setTyping(false);
            }
        });
        scene.add.existing(this);
        this.redraw();
    }

    get isEditing(): boolean {
        return this.editing;
    }

    getValue(): string {
        return this.value;
    }

    setValue(value: string): void {
        this.value = value;
        this.redraw();
    }

    /** Starts taking keys typed after `after` (a key event's timeStamp; default now). */
    startEditing(after = performance.now()): void {
        this.editing = true;
        this.since = after;
        this.valueBefore = this.value;
        setTyping(true);
        this.caretBlink.resume();
        this.redraw();
    }

    /** Stops editing and keeps what was typed. */
    finish(): string {
        this.stopEditing();
        return this.value;
    }

    /** Stops editing and puts back the value from before. */
    cancel(): void {
        this.value = this.valueBefore;
        this.stopEditing();
    }

    private stopEditing(): void {
        this.editing = false;
        setTyping(false);
        this.caretBlink.pause();
        this.redraw();
    }

    private readonly onKey = (event: KeyboardEvent): void => {
        // Phaser can hand the same event over more than once (see ui/keys.ts).
        if (!this.editing || this.seen.has(event) || event.timeStamp <= this.since) {
            return;
        }
        this.seen.add(event);
        if (event.key === 'Backspace') {
            this.value = [...this.value].slice(0, -1).join('');
        } else if (
            !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey
            && [...event.key].length === 1 && this.options.allowed.test(event.key)
            && [...this.value].length < this.options.maxLength
            // No leading or double spaces.
            && !(event.key === ' ' && (this.value === '' || this.value.endsWith(' ')))
        ) {
            this.value += event.key;
        } else {
            return;
        }
        this.redraw();
    };

    private redraw(): void {
        const { width } = this.options;
        this.box.clear()
            .fillStyle(COLOURS.ink, 0.85)
            .fillRoundedRect(-width / 2, -HEIGHT / 2, width, HEIGHT, 10)
            .lineStyle(2, this.editing ? COLOURS.goldBright : COLOURS.iron, 1)
            .strokeRoundedRect(-width / 2, -HEIGHT / 2, width, HEIGHT, 10);
        const empty = this.value === '';
        this.text.setText(empty ? this.options.placeholder : this.value);
        this.text.setColor(empty ? TEXT_COLOURS.dim : TEXT_COLOURS.primary);
        this.caret.setVisible(this.editing).setAlpha(1);
        this.caret.x = this.text.x + (empty ? 0 : this.text.width) + 3;
    }
}
