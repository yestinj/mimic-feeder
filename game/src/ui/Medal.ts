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

/**
 * What each medal shows: the game's own sprite where there is one, otherwise
 * a kit icon (the Staff and Magnet sprites are square tiles, which don't sit
 * in a round medal).
 */
const ICONS: Record<Stat, string> = {
    humansEaten: objectTexture('human'),
    dragonsEaten: objectTexture('dragon'),
    crowns: objectTexture('crown'),
    diamonds: objectTexture('diamond'),
    everythingCollected: TEXTURES.chestOpen,
    staffs: UI.iconStaff,
    magnets: UI.iconMagnetism,
    catsRescued: objectTexture('cat'),
    detonations: objectTexture('bomb'),
    destroyed: animationFrame('bombExplosion', 2),
    bosses: firstFrame('bossIdle'),
    bolts: firstFrame('shadowBolt'),
    tentacles: UI.iconTentacles,
    dashes: UI.iconDash,
    bestFloor: UI.iconFloor,
    bestLevel: UI.iconLevel,
    bestScore: UI.iconScore,
    longestRun: UI.iconTime,
    judgmentsSurvived: UI.iconEye,
    judgmentsCalled: objectTexture('cat'),
    flawlessBosses: firstFrame('bossIdle'),
    hotSnacks: objectTexture('bomb'),
    lastHeartFloors: UI.heartFull,
};

/** Sprites with a lot of empty space round them, drawn larger to fill the medal like the rest. */
const ICON_ZOOM: Partial<Record<Stat, number>> = { bosses: 1.9, flawlessBosses: 1.9 };

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
        const icon = scene.add.image(0, 0, ICONS[achievement.stat]);
        const box = size * ICON_SIZE * (ICON_ZOOM[achievement.stat] ?? 1);
        icon.setScale(Math.min(box / icon.width, box / icon.height));
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
