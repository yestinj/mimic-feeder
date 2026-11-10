// One run's state: score, lives, the mimic's level and growth, and progress
// through floors and zones (inventory §3 and §5). Each action returns the
// events it caused, in order, so scenes can show and play them.
import { CREATURE_KINDS, HAZARD_KINDS, OBJECTS, SHINY_KINDS, type CreatureKind, type HazardKind, type ShinyKind } from './objects';
import { CREATURES_PER_ZONE, gameLevel, nextZone } from './progression';

export const START_LIVES = 3;
/** Every 50 humans eaten add a heart (and fill it). */
export const HUMANS_PER_EXTRA_LIFE = 50;
/** XP for the first level-up; each later one needs twice the last. */
export const FIRST_LEVEL_XP = 100;
const XP_GROWTH = 2;

/** Per-level growth of the mimic: speed and size +5%, jump +3%. */
export const GROWTH = { speed: 1.05, size: 1.05, jump: 1.03 } as const;

export type RunEvent =
    | { readonly type: 'points'; readonly points: number }
    | { readonly type: 'levelUp'; readonly level: number }
    | { readonly type: 'zone'; readonly floor: number; readonly zone: number; readonly newFloor: boolean }
    | { readonly type: 'extraLife' }
    | { readonly type: 'lifeLost' }
    | { readonly type: 'gameOver' };

/** What the results screen shows about a finished run. */
export interface RunSummary {
    readonly score: number;
    readonly floor: number;
    readonly zone: number;
    readonly level: number;
    readonly playTimeMs: number;
    readonly creaturesEaten: number;
    readonly shiniesCollected: number;
}

export interface Growth {
    readonly speed: number;
    readonly size: number;
    readonly jump: number;
}

function zeroCounts<K extends string>(keys: readonly K[]): Record<K, number> {
    return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export class Run {
    score = 0;
    floor = 1;
    zone = 1;
    /** Creatures eaten in the current zone. */
    eatenInZone = 0;

    lives = START_LIVES;
    maxLives = START_LIVES;

    /** The mimic's level (not the run's game level). */
    level = 1;
    xp = 0;
    xpToNext = FIRST_LEVEL_XP;

    playTimeMs = 0;

    readonly eaten: Record<CreatureKind, number> = zeroCounts(CREATURE_KINDS);
    readonly collected: Record<ShinyKind, number> = zeroCounts(SHINY_KINDS);
    /** Creatures destroyed by hitting the side of the chest. */
    sideHits = 0;
    /** Creatures that hit the floor. */
    missed = 0;
    /** Hazards set off by touching them. Hazards that hit the floor don't count. */
    readonly detonated: Record<HazardKind, number> = zeroCounts(HAZARD_KINDS);

    /** Game level: Floor 1 Zone 1 is 1, and each zone adds 1. */
    get gameLevel(): number {
        return gameLevel(this.floor, this.zone);
    }

    get isOver(): boolean {
        return this.lives <= 0;
    }

    get creaturesEaten(): number {
        return CREATURE_KINDS.reduce((sum, kind) => sum + this.eaten[kind], 0);
    }

    get hazardsDetonated(): number {
        return HAZARD_KINDS.reduce((sum, kind) => sum + this.detonated[kind], 0);
    }

    /** Speed, size and jump multipliers for the mimic's level. */
    get growth(): Growth {
        const levels = this.level - 1;
        return {
            speed: GROWTH.speed ** levels,
            size: GROWTH.size ** levels,
            jump: GROWTH.jump ** levels,
        };
    }

    get shiniesCollected(): number {
        return SHINY_KINDS.reduce((sum, kind) => sum + this.collected[kind], 0);
    }

    summary(): RunSummary {
        return {
            score: this.score,
            floor: this.floor,
            zone: this.zone,
            level: this.level,
            playTimeMs: this.playTimeMs,
            creaturesEaten: this.creaturesEaten,
            shiniesCollected: this.shiniesCollected,
        };
    }

    /** Active play time. Call only while the run is being played (not paused, not over). */
    tick(ms: number): void {
        if (!this.isOver) {
            this.playTimeMs += ms;
        }
    }

    /** A creature went into the mouth. */
    eat(kind: CreatureKind): RunEvent[] {
        const events: RunEvent[] = [];
        this.eaten[kind] += 1;
        if (kind === 'human' && this.eaten.human % HUMANS_PER_EXTRA_LIFE === 0) {
            this.maxLives += 1;
            this.lives = Math.min(this.lives + 1, this.maxLives);
            events.push({ type: 'extraLife' });
        }
        events.push(...this.gain(OBJECTS[kind].points));
        this.eatenInZone += 1;
        if (this.eatenInZone >= CREATURES_PER_ZONE) {
            this.eatenInZone = 0;
            const previousFloor = this.floor;
            ({ floor: this.floor, zone: this.zone } = nextZone(this.floor, this.zone));
            events.push({ type: 'zone', floor: this.floor, zone: this.zone, newFloor: this.floor !== previousFloor });
        }
        return events;
    }

    /** A shiny was picked up. Shinies don't count towards clearing a zone. */
    collect(kind: ShinyKind): RunEvent[] {
        this.collected[kind] += 1;
        return this.gain(OBJECTS[kind].points);
    }

    /** A creature hit the side of the chest: it's destroyed and, like a miss, costs a life. */
    sideHit(): RunEvent[] {
        this.sideHits += 1;
        return this.loseLife();
    }

    /** A creature hit the floor. */
    miss(): RunEvent[] {
        this.missed += 1;
        return this.loseLife();
    }

    /** The mimic touched a hazard. */
    detonate(kind: HazardKind): RunEvent[] {
        this.detonated[kind] += 1;
        return this.loseLife();
    }

    private gain(points: number): RunEvent[] {
        if (points <= 0) {
            return [];
        }
        this.score += points;
        this.xp += points;
        const events: RunEvent[] = [{ type: 'points', points }];
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.xpToNext = Math.round(this.xpToNext * XP_GROWTH);
            this.level += 1;
            events.push({ type: 'levelUp', level: this.level });
        }
        return events;
    }

    private loseLife(): RunEvent[] {
        if (this.isOver) {
            return [];
        }
        this.lives -= 1;
        return this.isOver ? [{ type: 'lifeLost' }, { type: 'gameOver' }] : [{ type: 'lifeLost' }];
    }
}
