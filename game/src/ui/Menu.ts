import * as Phaser from 'phaser';
import type { Button } from './Button';

/**
 * Keyboard and mouse navigation for a vertical list of buttons: ↑/↓ or W/S move
 * the focus (wrapping round, skipping disabled buttons), Enter or Space selects,
 * and hovering with the mouse moves the focus too.
 */
export class Menu {
    private index: number;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly buttons: readonly Button[],
        initialIndex = 0,
    ) {
        this.index = this.nextEnabled(initialIndex, 0);
        buttons.forEach((button, i) => {
            button.onHover = () => {
                if (button.isEnabled()) {
                    this.focus(i);
                }
            };
        });

        const keyboard = scene.input.keyboard;
        if (keyboard) {
            const handlers: Record<string, () => void> = {
                'keydown-UP': () => this.move(-1),
                'keydown-W': () => this.move(-1),
                'keydown-DOWN': () => this.move(1),
                'keydown-S': () => this.move(1),
                'keydown-ENTER': () => this.current()?.select(),
                'keydown-SPACE': () => this.current()?.select(),
            };
            for (const [event, handler] of Object.entries(handlers)) {
                keyboard.on(event, handler);
            }
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
                for (const [event, handler] of Object.entries(handlers)) {
                    keyboard.off(event, handler);
                }
            });
        }
        this.focus(this.index);
    }

    current(): Button | undefined {
        return this.buttons[this.index];
    }

    private move(step: 1 | -1): void {
        this.focus(this.nextEnabled(this.index + step, step));
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
