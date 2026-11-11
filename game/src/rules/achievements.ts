// Achievements (plan §3.6): the p5 game's 32, plus five secret ones. Grind
// achievements count across all runs (the save's lifetime totals);
// milestones (floor, score, level, time) are reached in a single run, so they
// are measured on the personal bests. Each one adds score when it unlocks.
import { EDIBLE_KINDS } from './objects';
import type { Bests, Totals } from './save';

export type Tier = 'bronze' | 'silver' | 'gold';

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold'];

/** Score added when an achievement unlocks (the p5 game's Early, Mid and Late tiers). */
export const TIER_POINTS: Record<Tier, number> = { bronze: 25, silver: 50, gold: 100 };

/** What an achievement is measured on. */
export type Stat =
    | 'humansEaten'
    | 'dragonsEaten'
    | 'crowns'
    | 'diamonds'
    | 'everythingCollected'
    | 'staffs'
    | 'magnets'
    | 'catsRescued'
    | 'detonations'
    | 'destroyed'
    | 'bosses'
    | 'bolts'
    | 'tentacles'
    | 'dashes'
    | 'bestFloor'
    | 'bestLevel'
    | 'bestScore'
    | 'longestRun'
    | 'judgmentsSurvived'
    | 'judgmentsCalled'
    | 'flawlessBosses'
    | 'hotSnacks'
    | 'lastHeartFloors';

const sum = (counts: Readonly<Record<string, number>>, keys: readonly string[]): number => keys.reduce((total, key) => total + (counts[key] ?? 0), 0);

/** A stat's value from the lifetime totals and personal bests. */
export function statValue(stat: Stat, totals: Totals, bests: Bests): number {
    switch (stat) {
        case 'humansEaten':
            return totals.eaten.human;
        case 'dragonsEaten':
            return totals.eaten.dragon;
        case 'crowns':
            return totals.collected.crown;
        case 'diamonds':
            return totals.collected.diamond;
        case 'everythingCollected':
            // Everything eaten (cats included) and every shiny and power-up picked up.
            return sum(totals.eaten, EDIBLE_KINDS) + sum(totals.collected, Object.keys(totals.collected));
        case 'staffs':
            return totals.collected.staff;
        case 'magnets':
            return totals.collected.magnet;
        case 'catsRescued':
            return totals.catsRescued;
        case 'detonations':
            return totals.hazardsDetonated;
        case 'destroyed':
            return totals.destroyed;
        case 'bosses':
            return totals.bossesDefeated;
        case 'bolts':
            return totals.uses.shadowBolt;
        case 'tentacles':
            return totals.uses.tentacles;
        case 'dashes':
            return totals.uses.dash;
        case 'bestFloor':
            return bests.floor;
        case 'bestLevel':
            return bests.level;
        case 'bestScore':
            return bests.score;
        case 'longestRun':
            return bests.playTimeMs;
        case 'judgmentsSurvived':
            return totals.judgmentsSurvived;
        case 'judgmentsCalled':
            return totals.judgmentsCalled;
        case 'flawlessBosses':
            return totals.flawlessBosses;
        case 'hotSnacks':
            return totals.hotSnacks;
        case 'lastHeartFloors':
            return totals.lastHeartFloors;
    }
}

export interface Achievement {
    /** Kept from the p5 game for the original 32. */
    readonly id: string;
    readonly tier: Tier;
    readonly stat: Stat;
    readonly goal: number;
    /** Shown as "???" until earned. */
    readonly secret?: boolean;
}

const MINUTE_MS = 60_000;

export const ACHIEVEMENTS: readonly Achievement[] = [
    // Bronze (the p5 game's Early tier).
    { id: 'first_blood', tier: 'bronze', stat: 'humansEaten', goal: 1 },
    { id: 'staff_initiate', tier: 'bronze', stat: 'staffs', goal: 1 },
    { id: 'magnet_novice', tier: 'bronze', stat: 'magnets', goal: 1 },
    { id: 'cat_lover', tier: 'bronze', stat: 'catsRescued', goal: 3 },
    { id: 'volatile_rookie', tier: 'bronze', stat: 'detonations', goal: 10 },
    { id: 'treasure_hunter', tier: 'bronze', stat: 'crowns', goal: 3 },
    { id: 'dungeon_explorer', tier: 'bronze', stat: 'bestFloor', goal: 3 },
    { id: 'survivor', tier: 'bronze', stat: 'longestRun', goal: 3 * MINUTE_MS },
    // Silver (Mid).
    { id: 'bomb_squad', tier: 'silver', stat: 'detonations', goal: 25 },
    { id: 'diamond_collector', tier: 'silver', stat: 'diamonds', goal: 5 },
    { id: 'dragon_slayer', tier: 'silver', stat: 'dragonsEaten', goal: 10 },
    { id: 'high_score', tier: 'silver', stat: 'bestScore', goal: 5000 },
    { id: 'level_up', tier: 'silver', stat: 'bestLevel', goal: 8 },
    { id: 'dungeon_delver', tier: 'silver', stat: 'bestFloor', goal: 5 },
    { id: 'demolisher', tier: 'silver', stat: 'destroyed', goal: 75 },
    { id: 'cat_sanctuary', tier: 'silver', stat: 'catsRescued', goal: 10 },
    { id: 'boss_hunter', tier: 'silver', stat: 'bosses', goal: 1 },
    { id: 'spell_slinger', tier: 'silver', stat: 'bolts', goal: 250 },
    { id: 'tentacle_tactician', tier: 'silver', stat: 'tentacles', goal: 50 },
    { id: 'blink_striker', tier: 'silver', stat: 'dashes', goal: 125 },
    // Gold (Late).
    { id: 'abyss_walker', tier: 'gold', stat: 'bestFloor', goal: 8 },
    { id: 'apex_mimic', tier: 'gold', stat: 'bestLevel', goal: 12 },
    { id: 'dragon_feast', tier: 'gold', stat: 'dragonsEaten', goal: 25 },
    { id: 'legend_score', tier: 'gold', stat: 'bestScore', goal: 20_000 },
    { id: 'iron_stomach', tier: 'gold', stat: 'everythingCollected', goal: 300 },
    { id: 'cat_kingdom', tier: 'gold', stat: 'catsRescued', goal: 25 },
    { id: 'long_haul', tier: 'gold', stat: 'longestRun', goal: 30 * MINUTE_MS },
    { id: 'boss_slayer', tier: 'gold', stat: 'bosses', goal: 3 },
    { id: 'arcane_battery', tier: 'gold', stat: 'bolts', goal: 600 },
    { id: 'tentacle_overlord', tier: 'gold', stat: 'tentacles', goal: 150 },
    { id: 'dash_phantom', tier: 'gold', stat: 'dashes', goal: 300 },
    { id: 'hazard_warden', tier: 'gold', stat: 'detonations', goal: 60 },
    // Secret (new in the rewrite).
    { id: 'feline_felon', tier: 'bronze', stat: 'judgmentsCalled', goal: 1, secret: true },
    { id: 'hot_snack', tier: 'bronze', stat: 'hotSnacks', goal: 1, secret: true },
    { id: 'hanging_by_a_thread', tier: 'silver', stat: 'lastHeartFloors', goal: 1, secret: true },
    { id: 'judged_and_spared', tier: 'gold', stat: 'judgmentsSurvived', goal: 1, secret: true },
    { id: 'flawless_hunt', tier: 'gold', stat: 'flawlessBosses', goal: 1, secret: true },
];

/** How far along an achievement is: its stat, capped at the goal. */
export function progress(achievement: Achievement, totals: Totals, bests: Bests): number {
    return Math.min(achievement.goal, statValue(achievement.stat, totals, bests));
}

/** True if it's worth showing progress ("6 / 10"), rather than just locked or unlocked. */
export function showsProgress(achievement: Achievement): boolean {
    return achievement.goal > 1 && !achievement.secret;
}

/** Achievements now earned that aren't unlocked yet, in list order. */
export function newlyEarned(unlocked: Readonly<Record<string, string>>, totals: Totals, bests: Bests): Achievement[] {
    return ACHIEVEMENTS.filter((achievement) => !(achievement.id in unlocked) && statValue(achievement.stat, totals, bests) >= achievement.goal);
}

/** Unlocked out of all, for the screen's header. */
export function unlockedCount(unlocked: Readonly<Record<string, string>>): number {
    return ACHIEVEMENTS.filter((achievement) => achievement.id in unlocked).length;
}

/** Score earned from achievements so far, for the screen's header. */
export function pointsEarned(unlocked: Readonly<Record<string, string>>): number {
    return ACHIEVEMENTS.reduce((total, achievement) => total + (achievement.id in unlocked ? TIER_POINTS[achievement.tier] : 0), 0);
}
