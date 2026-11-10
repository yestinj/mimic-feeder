// Formatting for numbers and times shown to the player.

/** "45s" under a minute, otherwise "4m 12s". */
export function formatPlayTime(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    if (seconds < 60) {
        return `${seconds}s`;
    }
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Thousands separators: 12480 → "12,480". */
export function formatScore(score: number): string {
    return Math.round(score).toLocaleString('en-GB');
}
