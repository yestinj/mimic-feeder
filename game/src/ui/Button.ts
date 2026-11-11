import * as Phaser from 'phaser';
import { MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { SLICE, UI } from './kit';
import { addText } from './text';

export type ButtonState = 'normal' | 'focus' | 'pressed' | 'disabled';

const TEXTURES: Record<ButtonState, string> = {
    normal: UI.buttonNormal,
    focus: UI.buttonFocus,
    pressed: UI.buttonPressed,
    disabled: UI.buttonDisabled,
};

const LABEL_COLOURS: Record<ButtonState, string> = {
    normal: TEXT_COLOURS.primary,
    focus: TEXT_COLOURS.gold,
    pressed: TEXT_COLOURS.muted,
    disabled: TEXT_COLOURS.dim,
};

export interface ButtonOptions {
    readonly width?: number;
    readonly enabled?: boolean;
    /** A red label, for a choice that destroys something. */
    readonly danger?: boolean;
    readonly onSelect: () => void;
}

/**
 * A menu button with normal, focus, pressed and disabled states. Focus is
 * shared by keyboard and mouse: Menu moves it with the arrow keys, and hovering
 * focuses the button under the pointer.
 */
export class Button extends Phaser.GameObjects.Container {
    private readonly background: Phaser.GameObjects.NineSlice;
    private readonly label: Phaser.GameObjects.Text;
    private readonly onSelect: () => void;
    private readonly danger: boolean;
    private focused = false;
    private enabled: boolean;

    /** Called when the pointer moves onto the button (Menu uses it to move focus). */
    onHover: (() => void) | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, text: string, options: ButtonOptions) {
        super(scene, x, y);
        const width = options.width ?? 420;
        const height = 64;
        this.enabled = options.enabled ?? true;
        this.onSelect = options.onSelect;
        this.danger = options.danger ?? false;

        this.background = scene.add.nineslice(0, 0, UI.buttonNormal, undefined, width, height, SLICE.button, SLICE.button);
        this.label = addText(scene, 0, -2, text, TYPE.button, { role: 'display', bold: true }).setOrigin(0.5);
        this.add([this.background, this.label]);
        this.setSize(width, height);

        this.setInteractive({ useHandCursor: true });
        this.on(Phaser.Input.Events.POINTER_OVER, () => this.onHover?.());
        this.on(Phaser.Input.Events.POINTER_DOWN, () => {
            if (this.enabled) {
                this.paint('pressed');
            }
        });
        this.on(Phaser.Input.Events.POINTER_UP, () => this.select());
        this.on(Phaser.Input.Events.POINTER_OUT, () => this.paint(this.currentState()));

        scene.add.existing(this);
        this.paint(this.currentState());
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setFocused(focused: boolean): this {
        if (this.focused === focused) {
            return this;
        }
        this.focused = focused;
        this.paint(this.currentState());
        this.scene.tweens.add({ targets: this, scale: focused ? 1.04 : 1, duration: MOTION.fast, ease: MOTION.ease });
        return this;
    }

    /** Runs the action with a short press animation. Ignored while disabled. */
    select(): void {
        if (!this.enabled) {
            return;
        }
        this.paint('pressed');
        this.scene.time.delayedCall(MOTION.fast, () => {
            this.paint(this.currentState());
            this.onSelect();
        });
    }

    private currentState(): ButtonState {
        if (!this.enabled) {
            return 'disabled';
        }
        return this.focused ? 'focus' : 'normal';
    }

    private paint(state: ButtonState): void {
        this.background.setTexture(TEXTURES[state]);
        this.label.setColor(this.danger && (state === 'normal' || state === 'focus') ? TEXT_COLOURS.danger : LABEL_COLOURS[state]);
    }
}
