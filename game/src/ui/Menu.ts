import type * as Phaser from 'phaser';
import type { Button } from './Button';
import { onKeyDown } from './keys';

export interface MenuOptions {
    /** Focused at the start (default: the first enabled button). */
    readonly initialIndex?: number;
    /** A row of buttons, moved through with ←/→ or A/D instead of ↑/↓ or W/S. */
    readonly horizontal?: boolean;
}

/**
 * Keyboard and mouse navigation for a list of buttons: ↑/↓ or W/S (←/→ or A/D
 * for a row) move the focus, wrapping round and skipping disabled buttons;
 * Enter or Space selects; hovering with the mouse moves the focus too. A menu
 * can be switched off while something sits on top of it (a dialog).
 */
export class Menu {
    private index = 0;
    private enabled = true;
    private readonly stopListening: (() => void)[];

    constructor(
        scene: Phaser.Scene,
        private readonly buttons: readonly Button[],
        options: MenuOptions = {},
    ) {
        this.index = this.nextEnabled(options.initialIndex ?? 0, 0);
        buttons.forEach((button, i) => {
            button.onHover = () => {
                if (this.enabled && button.isEnabled()) {
                    this.focus(i);
                }
            };
        });

        const [back, forward] = options.horizontal ? [['LEFT', 'A'], ['RIGHT', 'D']] : [['UP', 'W'], ['DOWN', 'S']];
        this.stopListening = [
            onKeyDown(scene, ['ENTER', 'SPACE'], () => this.select()),
            onKeyDown(scene, back ?? [], () => this.move(-1), { repeat: true }),
            onKeyDown(scene, forward ?? [], () => this.move(1), { repeat: true }),
        ];
        this.focus(this.index);
    }

    /** Stops listening to the keyboard (for a menu removed before its scene ends). */
    destroy(): void {
        this.stopListening.forEach((stop) => stop());
    }

    current(): Button | undefined {
        return this.buttons[this.index];
    }

    /** Switches keyboard and hover handling off (for example, under a dialog) or back on. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    private select(): void {
        if (this.enabled) {
            this.current()?.select();
        }
    }

    private move(step: 1 | -1): void {
        if (this.enabled) {
            this.focus(this.nextEnabled(this.index + step, step));
        }
    }

    private focus(index: number): void {
        this.index = index;
        this.buttons.forEach((button, i) => button.setFocused(i === index));
    }

    /** First enabled index from `start`, stepping by `step` (0 means "start, or the first enabled after it"). */
    private nextEnabled(start: number, step: number): number {
        const count = this.buttons.length;
        if (count === 0) {
            return 0;
        }
        const direction = step === 0 ? 1 : step;
        for (let offset = 0; offset < count; offset++) {
            const i = (((start + offset * direction) % count) + count) % count;
            if (this.buttons[i]?.isEnabled()) {
                return i;
            }
        }
        return this.index;
    }
}
