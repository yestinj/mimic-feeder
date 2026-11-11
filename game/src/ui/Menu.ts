import type * as Phaser from 'phaser';
import { onKeyDown } from './keys';

/** Anything a menu can focus: buttons, and the rows of the Settings screen. */
export interface Focusable {
    /** Called when the pointer moves onto the item (the menu moves focus to it). */
    onHover: (() => void) | null;
    isEnabled(): boolean;
    setFocused(focused: boolean): unknown;
    /** Enter, Space or a click. `event` is the key press, if it was one. */
    select(event?: KeyboardEvent): void;
    /** ←/→ or A/D in a vertical menu: changes a slider or a toggle. */
    adjust?(step: 1 | -1): void;
    /** True while the item takes typed keys (a name being typed): only Enter reaches it. */
    readonly capturing?: boolean;
}

export interface MenuOptions {
    /** Focused at the start (default: the first enabled item). */
    readonly initialIndex?: number;
    /** A row of buttons, moved through with ←/→ or A/D instead of ↑/↓ or W/S. */
    readonly horizontal?: boolean;
}

/**
 * Keyboard and mouse navigation for a list of buttons or rows: ↑/↓ or W/S
 * (←/→ or A/D for a row of buttons) move the focus, wrapping round and
 * skipping disabled items; in a vertical menu ←/→ change the focused item's
 * value; Enter or Space selects; hovering with the mouse moves the focus too.
 * A menu can be switched off while something sits on top of it (a dialog).
 */
export class Menu {
    private index = 0;
    private enabled = true;
    private readonly stopListening: (() => void)[];

    constructor(
        scene: Phaser.Scene,
        private readonly items: readonly Focusable[],
        options: MenuOptions = {},
    ) {
        this.index = this.nextEnabled(options.initialIndex ?? 0, 0);
        items.forEach((item, i) => {
            item.onHover = () => {
                if (this.enabled && item.isEnabled() && !this.current()?.capturing) {
                    this.focus(i);
                }
            };
        });

        const [back, forward] = options.horizontal ? [['LEFT', 'A'], ['RIGHT', 'D']] : [['UP', 'W'], ['DOWN', 'S']];
        this.stopListening = [
            onKeyDown(scene, ['ENTER', 'SPACE'], (event) => this.select(event)),
            onKeyDown(scene, back ?? [], () => this.move(-1), { repeat: true }),
            onKeyDown(scene, forward ?? [], () => this.move(1), { repeat: true }),
        ];
        if (!options.horizontal) {
            this.stopListening.push(
                onKeyDown(scene, ['LEFT', 'A'], () => this.adjust(-1), { repeat: true }),
                onKeyDown(scene, ['RIGHT', 'D'], () => this.adjust(1), { repeat: true }),
            );
        }
        this.focus(this.index);
    }

    /** Stops listening to the keyboard (for a menu removed before its scene ends). */
    destroy(): void {
        this.stopListening.forEach((stop) => stop());
    }

    current(): Focusable | undefined {
        return this.items[this.index];
    }

    /** Switches keyboard and hover handling off (for example, under a dialog) or back on. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /** Moves the focus to an item (for example, back to the row a dialog was opened from). */
    focusItem(item: Focusable): void {
        const i = this.items.indexOf(item);
        if (i >= 0) {
            this.focus(i);
        }
    }

    private select(event: KeyboardEvent): void {
        const item = this.current();
        // While a name is being typed, Space is a space; only Enter finishes it.
        if (!this.enabled || !item || (item.capturing && event.key !== 'Enter')) {
            return;
        }
        item.select(event);
    }

    private move(step: 1 | -1): void {
        if (this.enabled && !this.current()?.capturing) {
            this.focus(this.nextEnabled(this.index + step, step));
        }
    }

    private adjust(step: 1 | -1): void {
        const item = this.current();
        if (this.enabled && item && !item.capturing) {
            item.adjust?.(step);
        }
    }

    private focus(index: number): void {
        this.index = index;
        this.items.forEach((item, i) => item.setFocused(i === index));
    }

    /** First enabled index from `start`, stepping by `step` (0 means "start, or the first enabled after it"). */
    private nextEnabled(start: number, step: number): number {
        const count = this.items.length;
        if (count === 0) {
            return 0;
        }
        const direction = step === 0 ? 1 : step;
        for (let offset = 0; offset < count; offset++) {
            const i = (((start + offset * direction) % count) + count) % count;
            if (this.items[i]?.isEnabled()) {
                return i;
            }
        }
        return this.index;
    }
}
