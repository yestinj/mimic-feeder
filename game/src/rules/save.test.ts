import { describe, expect, it } from 'vitest';
import { Run } from './run';
import {
    DEFAULT_NAME,
    HIGH_SCORE_COUNT,
    SAVE_VERSION,
    cleanName,
    defaultSave,
    emptyTotals,
    isNewerSave,
    nameMimic,
    parseSave,
    recordRun,
    scoreRank,
    type RunRecord,
} from './save';

const run = (score: number, extra: Partial<RunRecord> = {}): RunRecord => ({
    score,
    floor: 2,
    zone: 3,
    level: 4,
    playTimeMs: 60_000,
    totals: { ...emptyTotals(), runs: 1 },
    ...extra,
});

describe('save', () => {
    it('starts from the system motion setting', () => {
        expect(defaultSave(false).settings).toMatchObject({ screenShake: true, reducedMotion: false, musicVolume: 1 });
        expect(defaultSave(true).settings).toMatchObject({ screenShake: false, reducedMotion: true });
    });

    it('ignores missing, unreadable and unknown saves', () => {
        expect(parseSave(null, false)).toBeNull();
        expect(parseSave('{not json', false)).toBeNull();
        expect(parseSave(JSON.stringify({ version: 99 }), false)).toBeNull();
        expect(parseSave('[]', false)).toBeNull();
    });

    it('fills in anything missing or invalid with defaults', () => {
        const save = parseSave(JSON.stringify({
            version: SAVE_VERSION,
            name: '  Dr. Chompers!!  ',
            settings: { musicVolume: 3, effectsVolume: 'loud', muted: true },
            highScores: [{ name: 'A', score: 10, date: '2026-01-01' }, 'junk', { score: 5 }],
            totals: { runs: 2.7, eaten: { goblin: 4, unicorn: 9 } },
            discoveries: ['goblin', 'goblin', 3],
            introduced: ['shadowBolt', 'teleport'],
            achievementsSeen: ['first_blood', 7],
            discoveriesSeen: ['goblin', null],
        }), false);
        expect(save).not.toBeNull();
        expect(save?.name).toBe('Dr Chompers');
        expect(save?.settings).toEqual({ musicVolume: 1, effectsVolume: 1, muted: true, screenShake: true, reducedMotion: false });
        expect(save?.highScores).toHaveLength(1);
        expect(save?.highScores[0]).toMatchObject({ name: 'A', score: 10, floor: 1, zone: 1, level: 1 });
        expect(save?.totals.runs).toBe(2);
        expect(save?.totals.eaten.goblin).toBe(4);
        expect(save?.totals.eaten).not.toHaveProperty('unicorn');
        expect(save?.discoveries).toEqual(['goblin']);
        expect(save?.introduced).toEqual(['shadowBolt']);
        expect(save?.achievementsSeen).toEqual(['first_blood']);
        expect(save?.discoveriesSeen).toEqual(['goblin']);
    });

    it('cleans names: letters, digits and spaces, 12 at most, never empty', () => {
        expect(cleanName('  Big   Mimic  ')).toBe('Big Mimic');
        expect(cleanName('Ünïcødé 42')).toBe('Ünïcødé 42');
        expect(cleanName('abcdefghijklmnop')).toBe('abcdefghijkl');
        expect(cleanName('!!!')).toBe(DEFAULT_NAME);
        // Accents typed as separate marks, and vowel signs, are part of the name.
        expect(cleanName('Rene\u0301')).toBe('Rene\u0301');
        expect(cleanName('नमस्ते')).toBe('नमस्ते');
        // Twelve characters, never half of one.
        expect(cleanName('𝒜'.repeat(13))).toBe('𝒜'.repeat(12));
        expect(cleanName('\u0301\u0301')).toBe(DEFAULT_NAME);
    });

    it('recognises a save from a newer version', () => {
        expect(isNewerSave(JSON.stringify({ version: SAVE_VERSION + 1 }))).toBe(true);
        expect(isNewerSave(JSON.stringify({ version: SAVE_VERSION }))).toBe(false);
        expect(isNewerSave('{oops')).toBe(false);
        expect(isNewerSave(null)).toBe(false);
    });

    it('ranks scores on a top-10 board', () => {
        const scores = Array.from({ length: HIGH_SCORE_COUNT }, (_, i) => ({ name: 'A', score: (i + 1) * 100, floor: 1, zone: 1, level: 1, playTimeMs: 0, date: '2026-01-01' }));
        expect(scoreRank(scores, 5000)).toBe(1);
        expect(scoreRank(scores, 550)).toBe(6);
        expect(scoreRank(scores, 100)).toBeNull();
        expect(scoreRank([], 0)).toBeNull();
        expect(scoreRank([], 1)).toBe(1);
    });

    it('records a finished run: its place on the board, its bests and its totals', () => {
        let save = { ...defaultSave(false), name: 'Chomp' };
        for (const score of [300, 100, 200]) {
            save = recordRun(save, run(score), true, `2026-11-1${score / 100}`).save;
        }
        const { save: after, rank } = recordRun(save, run(250, { floor: 5, totals: { ...emptyTotals(), runs: 1, catsRescued: 2 } }), true, '2026-11-20');
        expect(rank).toBe(2);
        expect(after.highScores.map((entry) => entry.score)).toEqual([300, 250, 200, 100]);
        expect(after.highScores[1]).toMatchObject({ name: 'Chomp', floor: 5, date: '2026-11-20' });
        expect(after.bests).toMatchObject({ score: 300, floor: 5 });
        expect(after.totals).toMatchObject({ runs: 4, catsRescued: 2 });
    });

    it('counts an abandoned run towards totals and bests, but not the board', () => {
        const { save, rank } = recordRun(defaultSave(false), run(900), false, '2026-11-20');
        expect(rank).toBeNull();
        expect(save.highScores).toEqual([]);
        expect(save.bests.score).toBe(900);
        expect(save.totals.runs).toBe(1);
    });

    it('keeps only the top 10', () => {
        let save = defaultSave(false);
        for (let i = 1; i <= HIGH_SCORE_COUNT + 3; i++) {
            save = recordRun(save, run(i * 10), true, `2026-11-${10 + i}`).save;
        }
        expect(save.highScores).toHaveLength(HIGH_SCORE_COUNT);
        expect(save.highScores.at(-1)?.score).toBe(40);
    });

    it('names the mimic, and the score that asked for it', () => {
        const first = recordRun(defaultSave(false), run(500), true, '2026-11-20T10:00:00.000Z').save;
        const second = recordRun(first, run(300), true, '2026-11-21T10:00:00.000Z').save;
        expect(second.named).toBe(false);
        const named = nameMimic(second, ' Chomper ', '2026-11-21T10:00:00.000Z');
        expect(named).toMatchObject({ name: 'Chomper', named: true });
        expect(named.highScores.map((entry) => entry.name)).toEqual(['Mimic', 'Chomper']);
        expect(parseSave(JSON.stringify(named), false)?.named).toBe(true);
    });

    it("turns a run's counts into a record", () => {
        const game = new Run();
        game.eat('dragon');
        game.collect('crown');
        game.collectPowerUp('staff');
        game.shootCat();
        game.killCat();
        game.sideHit('goblin');
        game.use('dash');
        game.surviveJudgment();
        const record = game.record();
        expect(record.totals).toMatchObject({ runs: 1, catsShot: 1, catsKilled: 1, destroyed: 3, judgmentsSurvived: 1 });
        expect(record.totals.eaten.dragon).toBe(1);
        expect(record.totals.collected).toMatchObject({ crown: 1, staff: 1 });
        expect(record.totals.uses.dash).toBe(1);
    });
});
