import * as Phaser from 'phaser';

let typing = false;

/** True while a text field takes typed keys, so global shortcuts (M, F) stand down. */
export function isTyping(): boolean {
    return typing;
}

export function setTyping(on: boolean): void {
    typing = on;
}

export interface KeyOptions {
    /** Also act on the keyboard's auto-repeat while the key is held (menus: yes; actions: no). */
    readonly repeat?: boolean;
}

/**
 * Listens for key presses, each taken exactly once.
 *
 * Phaser 4.2's keyboard plugin replays the frame's earlier key events every
 * time another one arrives in the same frame. Two quick taps can then count
 * three times, and the key that resumes a scene can reach that scene too.
 * This listener ignores an event it has already handled, and any event from
 * before its scene was last started or resumed.
 *
 * `keys` are Phaser key names (UP, W, ENTER, ESC…). Returns a function that
 * stops listening; Phaser also drops the listeners when the scene shuts down.
 */
export function onKeyDown(scene: Phaser.Scene, keys: readonly string[], handler: (event: KeyboardEvent) => void, options: KeyOptions = {}): () => void {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        return () => {};
    }
    const seen = new WeakSet<KeyboardEvent>();
    let activeSince = performance.now();
    const markActive = (): void => {
        activeSince = performance.now();
    };
    const listener = (event: KeyboardEvent): void => {
        if (seen.has(event) || event.timeStamp < activeSince) {
            return;
        }
        seen.add(event);
        if (event.repeat && !options.repeat) {
            return;
        }
        handler(event);
    };

    scene.events.on(Phaser.Scenes.Events.RESUME, markActive);
    scene.events.on(Phaser.Scenes.Events.WAKE, markActive);
    for (const key of keys) {
        keyboard.on(`keydown-${key}`, listener);
    }
    const off = (): void => {
        scene.events.off(Phaser.Scenes.Events.RESUME, markActive);
        scene.events.off(Phaser.Scenes.Events.WAKE, markActive);
        for (const key of keys) {
            keyboard.off(`keydown-${key}`, listener);
        }
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    return off;
}
