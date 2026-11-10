// A small, read-only hook for the Playwright playtest. The rewrite uses ES
// modules, so tests can't reach game state through bare globals as they did
// with the p5 version; scenes report milestones here instead.

export interface MimicFeederTestHook {
    /** Scene keys that have finished creating, in order. */
    readonly ready: string[];
}

declare global {
    interface Window {
        __mimicFeeder?: MimicFeederTestHook;
    }
}

export function markReady(sceneKey: string): void {
    window.__mimicFeeder ??= { ready: [] };
    window.__mimicFeeder.ready.push(sceneKey);
}
