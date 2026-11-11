import { describe, expect, it } from 'vitest';
import {
    ACHIEVEMENTS,
    TIER_POINTS,
    markAchievementsSeen,
    newlyEarned,
    pointsEarned,
    progress,
    showsProgress,
    unlockEarned,
    unlockedCount,
    unseenAchievements,
} from './achievements';
import { Run } from './run';
import { addTotals, bestsWith, defaultSave, emptyTotals, type Bests, type Totals } from './save';
import { STRINGS } from '../strings';

const noBests: Bests = { score: 0, floor: 0, level: 0, playTimeMs: 0 };
const byId = (id: string) => {
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!achievement) {
        throw new Error(id);
    }
    return achievement;
};
const ids = (list: readonly { id: string }[]): string[] => list.map((entry) => entry.id);

describe('achievements', () => {
    it('keeps the p5 game\'s 32 and adds five secret ones, with unique ids', () => {
        expect(ACHIEVEMENTS).toHaveLength(37);
        expect(ACHIEVEMENTS.filter((entry) => entry.secret)).toHaveLength(5);
        expect(new Set(ids(ACHIEVEMENTS)).size).toBe(37);
        expect(TIER_POINTS).toEqual({ bronze: 25, silver: 50, gold: 100 });
    });

    it('has a name and description for every achievement, and a hint for every secret', () => {
        for (const { id, secret } of ACHIEVEMENTS) {
            expect(STRINGS.achievements.list[id]?.name, id).toBeTruthy();
            expect(STRINGS.achievements.list[id]?.description, id).toBeTruthy();
            if (secret) {
                expect(STRINGS.achievements.list[id]?.hint, id).toBeTruthy();
            }
        }
    });

    it('quietly unlocks what a save has already earned', () => {
        const fresh = defaultSave(false);
        expect(unlockEarned(fresh, 'today')).toBe(fresh);
        // Played before achievements existed: three cats rescued, Floor 3 reached.
        const played = { ...fresh, totals: { ...fresh.totals, catsRescued: 3 }, bests: { ...fresh.bests, floor: 3 } };
        const unlocked = unlockEarned(played, 'today');
        expect(unlocked.achievements).toEqual({ cat_lover: 'today', dungeon_explorer: 'today' });
        expect(unlocked.bests.score).toBe(0);
        expect(unlockEarned(unlocked, 'later')).toBe(unlocked);
    });

    it('marks unlocks "new" until the achievements screen has been opened', () => {
        const save = { ...defaultSave(false), achievements: { first_blood: 'x', boss_hunter: 'y' } };
        expect(unseenAchievements(save)).toEqual(['first_blood', 'boss_hunter']);
        const seen = markAchievementsSeen(save);
        expect(unseenAchievements(seen)).toEqual([]);
        expect(unseenAchievements({ ...seen, achievements: { ...seen.achievements, cat_lover: 'z' } })).toEqual(['cat_lover']);
    });

    it('counts grind achievements across runs', () => {
        const runOne: Totals = { ...emptyTotals(), catsRescued: 2, uses: { ...emptyTotals().uses, shadowBolt: 200 } };
        const runTwo: Totals = { ...emptyTotals(), catsRescued: 1, uses: { ...emptyTotals().uses, shadowBolt: 60 } };
        expect(ids(newlyEarned({}, runOne, noBests))).not.toContain('cat_lover');
        const both = addTotals(runOne, runTwo);
        expect(ids(newlyEarned({}, both, noBests))).toEqual(expect.arrayContaining(['cat_lover', 'spell_slinger']));
        expect(progress(byId('cat_sanctuary'), both, noBests)).toBe(3);
    });

    it('measures milestones on a single run, through the bests', () => {
        const bests = bestsWith(noBests, { score: 5200, floor: 3, zone: 1, level: 8, playTimeMs: 200_000, totals: emptyTotals() });
        expect(ids(newlyEarned({}, emptyTotals(), bests))).toEqual(['dungeon_explorer', 'survivor', 'high_score', 'level_up']);
    });

    it('skips what is already unlocked', () => {
        const totals = { ...emptyTotals(), eaten: { ...emptyTotals().eaten, human: 1 } };
        expect(ids(newlyEarned({}, totals, noBests))).toEqual(['first_blood']);
        expect(newlyEarned({ first_blood: '2026-11-11T00:00:00.000Z' }, totals, noBests)).toEqual([]);
        expect(unlockedCount({ first_blood: 'x', not_an_achievement: 'y' })).toBe(1);
        expect(pointsEarned({ first_blood: 'x', boss_hunter: 'x', flawless_hunt: 'x', not_an_achievement: 'y' })).toBe(25 + 50 + 100);
    });

    it('caps progress at the goal and only shows it for counted, non-secret ones', () => {
        const totals = { ...emptyTotals(), eaten: { ...emptyTotals().eaten, dragon: 40 } };
        expect(progress(byId('dragon_slayer'), totals, noBests)).toBe(10);
        expect(showsProgress(byId('dragon_slayer'))).toBe(true);
        expect(showsProgress(byId('first_blood'))).toBe(false);
        expect(showsProgress(byId('hot_snack'))).toBe(false);
    });

    it('counts everything eaten and collected for Iron Stomach', () => {
        const run = new Run();
        run.eat('goblin');
        run.eat('cat');
        run.collect('crown');
        run.collectPowerUp('potion');
        expect(progress(byId('iron_stomach'), run.record().totals, noBests)).toBe(4);
    });
});

describe('secret achievements', () => {
    const earnedBy = (run: Run): string[] => ids(newlyEarned(defaultSave(false).achievements, run.record().totals, noBests)).filter((id) => byId(id).secret);

    it('Hot Snack: a bomb pulled into the mouth', () => {
        const run = new Run();
        run.detonate('bomb');
        expect(earnedBy(run)).toEqual([]);
        run.detonate('bomb', true);
        expect(earnedBy(run)).toEqual(['hot_snack']);
    });

    it('Flawless Hunt: a boss beaten without losing a heart in the fight', () => {
        const startFight = (run: Run): void => {
            run.floor = 2;
            run.zone = 4;
            run.eatenInZone = 9;
            run.eat('goblin');
            expect(run.inBossFight).toBe(true);
        };
        const clean = new Run();
        clean.detonate('bomb');
        startFight(clean);
        clean.defeatBoss();
        expect(earnedBy(clean)).toContain('flawless_hunt');

        const hurt = new Run();
        startFight(hurt);
        hurt.burn();
        hurt.defeatBoss();
        expect(earnedBy(hurt)).not.toContain('flawless_hunt');
    });

    it('Hanging by a Thread: a new floor on the last heart', () => {
        const run = new Run();
        run.detonate('bomb');
        run.detonate('bomb');
        run.zone = 5;
        run.eatenInZone = 9;
        run.eat('goblin');
        expect(run.floor).toBe(2);
        expect(earnedBy(run)).toContain('hanging_by_a_thread');
    });

    it('Feline Felon and Judged and Spared: the Ninefold Judgment', () => {
        const run = new Run();
        for (let i = 0; i < 10; i++) {
            run.shootCat();
        }
        expect(run.judged).toBe(true);
        expect(earnedBy(run)).toEqual(['feline_felon']);
        run.surviveJudgment();
        expect(earnedBy(run)).toEqual(['feline_felon', 'judged_and_spared']);
    });
});
