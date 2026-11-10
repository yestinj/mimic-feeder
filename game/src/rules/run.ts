// One run's state: score, lives, the mimic's level and growth, and progress
// through floors and zones (inventory §3 and §5). Each action returns the
// events it caused, in order, so scenes can show and play them.
import { TENTACLES_FROM_LEVEL, tentacleReach, type Ability } from './abilities';
import { BOSS, isBossZone } from './boss';
import { CAT_RESCUE_POINTS } from './cats';
import { JUDGMENT } from './judgment';
import { EDIBLE_KINDS, HAZARD_KINDS, OBJECTS, POWER_UP_KINDS, SHINY_KINDS, type CreatureKind, type EdibleKind, type HazardKind, type ObjectKind, type PowerUpKind, type ShinyKind } from './objects';
import { pickPowerUp } from './offers';
import { CREATURES_PER_ZONE, gameLevel, nextZone } from './progression';
import type { RunRecord } from './save';
import type { Rng } from './spawner';

export const START_LIVES = 3;
/** Every 50 humans eaten add a heart (and fill it). */
export const HUMANS_PER_EXTRA_LIFE = 50;
/** XP for the first level-up; each later one needs twice the last. */
export const FIRST_LEVEL_XP = 100;
const XP_GROWTH = 2;

/** Score and XP for setting off a bomb with a Shadow Bolt. */
export const BOLTED_BOMB_POINTS = 10;

/** Per-level growth of the mimic: speed and size +5%, jump +3%. */
export const GROWTH = { speed: 1.05, size: 1.05, jump: 1.03 } as const;

/** What cost a life: the last one is the run's cause of death. */
export type DeathCause =
    /** A creature hit the floor or the side of the chest. */
    | { readonly type: 'wasted'; readonly creature: CreatureKind }
    | { readonly type: 'bomb' }
    | { readonly type: 'fireball' }
    | { readonly type: 'boss' }
    | { readonly type: 'judgment' };

export type RunEvent =
    | { readonly type: 'points'; readonly points: number }
    | { readonly type: 'levelUp'; readonly level: number }
    /** A new zone or floor. `boss`: this zone is a boss fight (Zone 5 of an even floor). */
    | { readonly type: 'zone'; readonly floor: number; readonly zone: number; readonly newFloor: boolean; readonly boss: boolean }
    | { readonly type: 'bossDefeated' }
    | { readonly type: 'extraLife' }
    | { readonly type: 'lifeGained' }
    | { readonly type: 'lifeLost' }
    | { readonly type: 'unlock'; readonly ability: Ability }
    | { readonly type: 'tentaclesGrow'; readonly reach: number }
    /** Five cats shot: the dungeon warns once. */
    | { readonly type: 'catWarning' }
    /** Ten cats shot: the Ninefold Judgment begins. */
    | { readonly type: 'judgment' }
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
    /** What cost the last life (null if the run didn't end in a loss). */
    readonly causeOfDeath: DeathCause | null;
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

    readonly eaten: Record<EdibleKind, number> = zeroCounts(EDIBLE_KINDS);
    readonly collected: Record<ShinyKind, number> = zeroCounts(SHINY_KINDS);
    readonly powerUps: Record<PowerUpKind, number> = zeroCounts(POWER_UP_KINDS);
    /** Creatures destroyed by hitting the side of the chest. */
    sideHits = 0;
    /** Creatures that hit the floor. */
    missed = 0;
    /** Hazards set off by touching, shooting or pulling them in. Hazards that hit the floor don't count. */
    readonly detonated: Record<HazardKind, number> = zeroCounts(HAZARD_KINDS);
    /** Objects destroyed by Shadow Bolts (bombs included). */
    shotDown = 0;

    catsRescued = 0;
    /** Cats killed by touching them other than through the mouth. */
    catsKilled = 0;
    /** Cats killed with Shadow Bolts (the Ninefold Judgment counts these, M2c). */
    catsShot = 0;

    /** The dungeon has warned about shot cats, and has judged (each happens once per run). */
    catWarningGiven = false;
    judged = false;
    judgmentsSurvived = 0;
    /** What cost the most recent life. */
    lastLoss: DeathCause | null = null;

    /** A boss fight is on (from its zone starting until the next floor). */
    inBossFight = false;
    bossesDefeated = 0;

    hasStaff = false;
    hasMagnet = false;
    staffOffers = 0;
    magnetOffers = 0;
    lastPotionLevel = 0;

    /** Ability uses this run (lifetime totals and achievements build on these in M3). */
    readonly uses: Record<Ability, number> = { dash: 0, shadowBolt: 0, tentacles: 0, magnetism: 0 };

    /** Game level: Floor 1 Zone 1 is 1, and each zone adds 1. */
    get gameLevel(): number {
        return gameLevel(this.floor, this.zone);
    }

    get isOver(): boolean {
        return this.lives <= 0;
    }

    /** Everything eaten: creatures and cats. */
    get creaturesEaten(): number {
        return EDIBLE_KINDS.reduce((sum, kind) => sum + this.eaten[kind], 0);
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

    /** Creatures the tentacles grab at once (0 until they unlock). */
    get tentacleReach(): number {
        return tentacleReach(this.level);
    }

    hasAbility(ability: Ability): boolean {
        switch (ability) {
            case 'dash':
                return true;
            case 'shadowBolt':
                return this.hasStaff;
            case 'tentacles':
                return this.level >= TENTACLES_FROM_LEVEL;
            case 'magnetism':
                return this.hasMagnet;
        }
    }

    /** Counts an ability use. */
    use(ability: Ability): void {
        this.uses[ability] += 1;
    }

    /** The power-up to drop instead of a normal spawn, if one is due; records the offer. */
    offerPowerUp(onScreen: ReadonlySet<ObjectKind>, rng: Rng): PowerUpKind | null {
        const kind = pickPowerUp(this, onScreen, rng);
        if (kind === 'staff') {
            this.staffOffers += 1;
        } else if (kind === 'magnet') {
            this.magnetOffers += 1;
        } else if (kind === 'potion') {
            this.lastPotionLevel = this.gameLevel;
        }
        return kind;
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
            causeOfDeath: this.isOver ? this.lastLoss : null,
        };
    }

    /** Active play time. Call only while the run is being played (not paused, not over). */
    tick(ms: number): void {
        if (!this.isOver) {
            this.playTimeMs += ms;
        }
    }

    /** A creature or cat went into the mouth. Cats score nothing but count towards the zone. */
    eat(kind: EdibleKind): RunEvent[] {
        const events: RunEvent[] = [];
        this.eaten[kind] += 1;
        if (kind === 'human' && this.eaten.human % HUMANS_PER_EXTRA_LIFE === 0) {
            this.maxLives += 1;
            this.lives = Math.min(this.lives + 1, this.maxLives);
            events.push({ type: 'extraLife' });
        }
        events.push(...this.gain(OBJECTS[kind].points));
        // Nothing else falls during a boss fight, so its zone can't be cleared by eating.
        this.eatenInZone += 1;
        if (this.eatenInZone >= CREATURES_PER_ZONE && !this.inBossFight) {
            this.eatenInZone = 0;
            const previousFloor = this.floor;
            ({ floor: this.floor, zone: this.zone } = nextZone(this.floor, this.zone));
            const boss = isBossZone(this.floor, this.zone);
            this.inBossFight = boss;
            events.push({ type: 'zone', floor: this.floor, zone: this.zone, newFloor: this.floor !== previousFloor, boss });
        }
        return events;
    }

    /** The boss is beaten: its points, and the fight is won (the next floor follows its death). */
    defeatBoss(): RunEvent[] {
        this.bossesDefeated += 1;
        return [...this.gain(BOSS.points), { type: 'bossDefeated' }];
    }

    /** After a boss: on to the next floor, Zone 1. */
    finishBossFloor(): RunEvent[] {
        this.inBossFight = false;
        this.floor += 1;
        this.zone = 1;
        this.eatenInZone = 0;
        return [{ type: 'zone', floor: this.floor, zone: this.zone, newFloor: true, boss: false }];
    }

    /** A cat waited on the floor long enough to be rescued. */
    rescueCat(): RunEvent[] {
        this.catsRescued += 1;
        return this.gain(CAT_RESCUE_POINTS);
    }

    /** A cat was touched other than through the mouth: it dies, but no life is lost. */
    killCat(): void {
        this.catsKilled += 1;
    }

    /** A Shadow Bolt killed a cat. The fifth brings the dungeon's warning, the tenth its judgment. */
    shootCat(): RunEvent[] {
        this.catsShot += 1;
        this.shotDown += 1;
        const events: RunEvent[] = [];
        if (!this.catWarningGiven && this.catsShot >= JUDGMENT.warningAt) {
            this.catWarningGiven = true;
            events.push({ type: 'catWarning' });
        }
        if (!this.judged && this.catsShot >= JUDGMENT.judgmentAt) {
            this.judged = true;
            events.push({ type: 'judgment' });
        }
        return events;
    }

    /** A shiny was picked up. Shinies don't count towards clearing a zone. */
    collect(kind: ShinyKind): RunEvent[] {
        this.collected[kind] += 1;
        return this.gain(OBJECTS[kind].points);
    }

    /** A power-up was picked up: the Staff and Magnet unlock abilities, a potion fills a heart. */
    collectPowerUp(kind: PowerUpKind): RunEvent[] {
        this.powerUps[kind] += 1;
        switch (kind) {
            case 'staff':
                this.hasStaff = true;
                return [{ type: 'unlock', ability: 'shadowBolt' }];
            case 'magnet':
                this.hasMagnet = true;
                return [{ type: 'unlock', ability: 'magnetism' }];
            case 'potion':
                if (this.lives >= this.maxLives) {
                    return [];
                }
                this.lives += 1;
                return [{ type: 'lifeGained' }];
        }
    }

    /** A Shadow Bolt set off a bomb: points and XP, and it counts as a detonation. No life lost. */
    shootHazard(kind: HazardKind): RunEvent[] {
        this.detonated[kind] += 1;
        this.shotDown += 1;
        return this.gain(BOLTED_BOMB_POINTS);
    }

    /** A Shadow Bolt destroyed something else: no points, no penalty. */
    shoot(): void {
        this.shotDown += 1;
    }

    /** Bonus score and XP (cat rescues and bosses, from M2b). */
    bonus(points: number): RunEvent[] {
        return this.gain(points);
    }

    /** The Ninefold Judgment ended with the mimic still alive. */
    surviveJudgment(): void {
        this.judgmentsSurvived += 1;
    }

    /** What this run adds to the save: its result and its own counts. */
    record(): RunRecord {
        return {
            score: this.score,
            floor: this.floor,
            zone: this.zone,
            level: this.level,
            playTimeMs: this.playTimeMs,
            totals: {
                runs: 1,
                playTimeMs: this.playTimeMs,
                eaten: { ...this.eaten },
                collected: { ...this.collected, ...this.powerUps },
                catsRescued: this.catsRescued,
                catsKilled: this.catsKilled,
                catsShot: this.catsShot,
                hazardsDetonated: this.hazardsDetonated,
                destroyed: this.sideHits + this.catsKilled + this.shotDown,
                bossesDefeated: this.bossesDefeated,
                judgmentsSurvived: this.judgmentsSurvived,
                uses: { ...this.uses },
            },
        };
    }

    /** A boss fireball hit the mimic. */
    burn(): RunEvent[] {
        return this.loseLife({ type: 'boss' });
    }

    /** A fireball of the Ninefold Judgment hit the mimic. */
    judge(): RunEvent[] {
        return this.loseLife({ type: 'judgment' });
    }

    /** A creature hit the side of the chest: it's destroyed and, like a miss, costs a life. */
    sideHit(kind: CreatureKind): RunEvent[] {
        this.sideHits += 1;
        return this.loseLife({ type: 'wasted', creature: kind });
    }

    /** A creature hit the floor. */
    miss(kind: CreatureKind): RunEvent[] {
        this.missed += 1;
        return this.loseLife({ type: 'wasted', creature: kind });
    }

    /** The mimic touched a hazard. */
    detonate(kind: HazardKind): RunEvent[] {
        this.detonated[kind] += 1;
        return this.loseLife({ type: kind });
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
            if (this.level === TENTACLES_FROM_LEVEL) {
                events.push({ type: 'unlock', ability: 'tentacles' });
            } else if (this.level > TENTACLES_FROM_LEVEL) {
                events.push({ type: 'tentaclesGrow', reach: this.tentacleReach });
            }
        }
        return events;
    }

    private loseLife(cause: DeathCause): RunEvent[] {
        if (this.isOver) {
            return [];
        }
        this.lives -= 1;
        this.lastLoss = cause;
        return this.isOver ? [{ type: 'lifeLost' }, { type: 'gameOver' }] : [{ type: 'lifeLost' }];
    }
}
