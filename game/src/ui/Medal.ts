import * as Phaser from 'phaser';
import { animationFrame, firstFrame, objectTexture, TEXTURES } from '../assets';
import type { Achievement, Stat, Tier } from '../rules/achievements';
import { COLOURS, TEXT_COLOURS } from '../theme';
import { UI } from './kit';
import { addText } from './text';

/** Frame, bar and glow colours by tier. */
export const TIER_COLOURS: Record<Tier, number> = { bronze: 0xc07a43, silver: 0xc9ced3, gold: COLOURS.gold };

/** Text colours by tier, a little lighter than the metal so they read on dark stone. */
export const TIER_TEXT_COLOURS: Record<Tier, string> = { bronze: '#eaa877', silver: '#e4e8ec', gold: TEXT_COLOURS.gold };

const MEDALS: Record<Tier, string> = { bronze: UI.medalBronze, silver: UI.medalSilver, gold: UI.medalGold };

interface Icon {
    readonly key: string;
    /** For sprites with a lot of empty space round them: drawn larger to fill the medal like the rest. */
    readonly zoom?: number;
    /**
     * For sprites whose figure isn't in the middle of the image: moved right
     * and down by these fractions of its drawn size, so it looks centred.
     */
    readonly nudge?: { readonly x: number; readonly y: number };
}

/** The boss's frames have room round it for its wings and attacks. */
const BOSS: Icon = { key: firstFrame('bossIdle'), zoom: 1.9, nudge: { x: 0.05, y: 0.06 } };
/** The cat sits left of the middle, with its tail out to the right; it's tall and thin, so a little larger too. */
const CAT: Icon = { key: objectTexture('cat'), zoom: 1.15, nudge: { x: 0.07, y: 0 } };
const BOMB: Icon = { key: objectTexture('bomb') };

/**
 * What each medal shows: the game's own sprite where there is one, otherwise
 * a kit icon (the Staff and Magnet sprites are square tiles, which don't sit
 * in a round medal).
 */
const ICONS: Record<Stat, Icon> = {
    humansEaten: { key: objectTexture('human') },
    dragonsEaten: { key: objectTexture('dragon') },
    crowns: { key: objectTexture('crown') },
    diamonds: { key: objectTexture('diamond') },
    everythingCollected: { key: TEXTURES.chestOpen },
    staffs: { key: UI.iconStaff },
    magnets: { key: UI.iconMagnetism },
    catsRescued: CAT,
    detonations: BOMB,
    destroyed: { key: animationFrame('bombExplosion', 2) },
    bosses: BOSS,
    bolts: { key: firstFrame('shadowBolt'), nudge: { x: -0.07, y: 0 } },
    tentacles: { key: UI.iconTentacles },
    dashes: { key: UI.iconDash },
    bestFloor: { key: UI.iconFloor },
    bestLevel: { key: UI.iconLevel },
    bestScore: { key: UI.iconScore },
    longestRun: { key: UI.iconTime },
    judgmentsSurvived: { key: UI.iconEye },
    judgmentsCalled: CAT,
    flawlessBosses: BOSS,
    hotSnacks: BOMB,
    lastHeartFloors: { key: UI.heartFull },
};

/** A locked medal's icon is a dark silhouette of it. */
const SILHOUETTE = 0x5c4f44;
/** How much of the medal the icon fills. */
const ICON_SIZE = 0.52;

/** Earned, not yet earned, or a secret still hidden ("?"). */
export type MedalState = 'unlocked' | 'locked' | 'hidden';

/**
 * An achievement's medal, `size` across, centred on (x, y): its tier's metal
 * once earned (with a soft glow), dark iron before. The icon says what it's for.
 */
export function addMedal(scene: Phaser.Scene, x: number, y: number, achievement: Achievement, state: MedalState, size: number): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (state === 'unlocked') {
        parts.push(scene.add.image(0, 0, UI.glow).setDisplaySize(size * 1.7, size * 1.7).setTint(TIER_COLOURS[achievement.tier]).setAlpha(0.4));
    }
    parts.push(scene.add.image(0, 0, state === 'unlocked' ? MEDALS[achievement.tier] : UI.medalLocked).setDisplaySize(size, size));
    if (state === 'hidden') {
        parts.push(addText(scene, 0, 0, '?', Math.round(size * 0.42), { role: 'display', bold: true, colour: TEXT_COLOURS.dim }).setOrigin(0.5));
    } else {
        const { key, zoom = 1, nudge } = ICONS[achievement.stat];
        const icon = scene.add.image(0, 0, key);
        const box = size * ICON_SIZE * zoom;
        icon.setScale(Math.min(box / icon.width, box / icon.height));
        if (nudge) {
            icon.setPosition(icon.displayWidth * nudge.x, icon.displayHeight * nudge.y);
        }
        if (state === 'locked') {
            icon.setTint(SILHOUETTE).setTintMode(Phaser.TintModes.FILL);
        }
        parts.push(icon);
    }
    return scene.add.container(x, y, parts);
}

/** A small medal for a tab: the tier's metal with a disc of it in the middle, or the locked one with a "?" for the secrets. */
export function addTabMedal(scene: Phaser.Scene, x: number, y: number, tier: Tier | 'secret', size: number): Phaser.GameObjects.Container {
    const medal = scene.add.image(0, 0, tier === 'secret' ? UI.medalLocked : MEDALS[tier]).setDisplaySize(size, size);
    const parts: Phaser.GameObjects.GameObject[] = [medal];
    if (tier !== 'secret') {
        parts.push(scene.add.circle(0, 0, size * 0.24, TIER_COLOURS[tier]).setStrokeStyle(2, COLOURS.ink, 0.8));
    } else {
        parts.push(addText(scene, 0, 0, '?', Math.round(size * 0.5), { role: 'display', bold: true, colour: TEXT_COLOURS.muted, shadow: false }).setOrigin(0.5));
    }
    return scene.add.container(x, y, parts);
}
