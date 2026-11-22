// Formatting for numbers and times shown to the player.

/** "45s" under a minute, otherwise "4m 12s". */
export function formatPlayTime(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    if (seconds < 60) {
        return `${seconds}s`;
    }
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** A day in the player's own format ("11 Nov 2026"); '' if the save holds something odd. */
export function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}

/** Thousands separators: 12480 → "12,480". */
export function formatScore(score: number): string {
    return Math.round(score).toLocaleString('en-GB');
}
