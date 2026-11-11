// The generated UI kit: SVG art in ./kit/, loaded as ordinary images.
// (Phaser's own SVG loader creates blob: URLs, which the site's CSP blocks;
// plain images work, and the SVGs carry their own pixel size.)
import type * as Phaser from 'phaser';
import abilitySlotUrl from './kit/ability-slot.svg?url';
import badgeUrl from './kit/badge.svg?url';
import bannerUrl from './kit/banner.svg?url';
import barFillUrl from './kit/bar-fill.svg?url';
import barFrameUrl from './kit/bar-frame.svg?url';
import buttonDisabledUrl from './kit/button-disabled.svg?url';
import buttonFocusUrl from './kit/button-focus.svg?url';
import buttonNormalUrl from './kit/button-normal.svg?url';
import buttonPressedUrl from './kit/button-pressed.svg?url';
import edgeGlowUrl from './kit/edge-glow.svg?url';
import glowUrl from './kit/glow.svg?url';
import heartEmptyUrl from './kit/heart-empty.svg?url';
import heartFullUrl from './kit/heart-full.svg?url';
import iconDashUrl from './kit/icon-dash.svg?url';
import iconEyeUrl from './kit/icon-eye.svg?url';
import iconFloorUrl from './kit/icon-floor.svg?url';
import iconLevelUrl from './kit/icon-level.svg?url';
import iconMagnetUrl from './kit/icon-magnet.svg?url';
import iconScoreUrl from './kit/icon-score.svg?url';
import iconStaffUrl from './kit/icon-staff.svg?url';
import iconTentaclesUrl from './kit/icon-tentacles.svg?url';
import iconTimeUrl from './kit/icon-time.svg?url';
import keycapUrl from './kit/keycap.svg?url';
import medalBronzeUrl from './kit/medal-bronze.svg?url';
import medalGoldUrl from './kit/medal-gold.svg?url';
import medalLockedUrl from './kit/medal-locked.svg?url';
import medalSilverUrl from './kit/medal-silver.svg?url';
import panelJudgmentUrl from './kit/panel-judgment.svg?url';
import panelUrl from './kit/panel.svg?url';
import soundOffUrl from './kit/sound-off.svg?url';

const KIT = {
    panel: ['ui-panel', panelUrl],
    panelJudgment: ['ui-panel-judgment', panelJudgmentUrl],
    buttonNormal: ['ui-button-normal', buttonNormalUrl],
    buttonFocus: ['ui-button-focus', buttonFocusUrl],
    buttonPressed: ['ui-button-pressed', buttonPressedUrl],
    buttonDisabled: ['ui-button-disabled', buttonDisabledUrl],
    keycap: ['ui-keycap', keycapUrl],
    heartFull: ['ui-heart-full', heartFullUrl],
    heartEmpty: ['ui-heart-empty', heartEmptyUrl],
    badge: ['ui-badge', badgeUrl],
    barFrame: ['ui-bar-frame', barFrameUrl],
    barFill: ['ui-bar-fill', barFillUrl],
    banner: ['ui-banner', bannerUrl],
    soundOff: ['ui-sound-off', soundOffUrl],
    glow: ['ui-glow', glowUrl],
    edgeGlow: ['ui-edge-glow', edgeGlowUrl],
    abilitySlot: ['ui-ability-slot', abilitySlotUrl],
    iconDash: ['ui-icon-dash', iconDashUrl],
    iconTentacles: ['ui-icon-tentacles', iconTentaclesUrl],
    iconMagnetism: ['ui-icon-magnetism', iconMagnetUrl],
    iconFloor: ['ui-icon-floor', iconFloorUrl],
    iconLevel: ['ui-icon-level', iconLevelUrl],
    iconScore: ['ui-icon-score', iconScoreUrl],
    iconTime: ['ui-icon-time', iconTimeUrl],
    iconStaff: ['ui-icon-staff', iconStaffUrl],
    iconEye: ['ui-icon-eye', iconEyeUrl],
    medalBronze: ['ui-medal-bronze', medalBronzeUrl],
    medalSilver: ['ui-medal-silver', medalSilverUrl],
    medalGold: ['ui-medal-gold', medalGoldUrl],
    medalLocked: ['ui-medal-locked', medalLockedUrl],
} as const;

type KitName = keyof typeof KIT;

/** Texture keys for the kit. */
export const UI = Object.fromEntries(Object.entries(KIT).map(([name, [key]]) => [name, key])) as {
    readonly [Name in KitName]: (typeof KIT)[Name][0];
};

/** Fixed (non-stretching) border sizes of each nine- or three-slice texture. */
export const SLICE = {
    panel: 32,
    button: 28,
    keycap: 18,
    barFrame: 14,
    banner: 100,
} as const;

export function preloadUiKit(scene: Phaser.Scene): void {
    for (const [key, url] of Object.values(KIT)) {
        scene.load.image(key, url);
    }
}

/** A panel of any size, centred on (x, y); the judgment style is the Ninefold Judgment's violet and crimson. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, style: 'normal' | 'judgment' = 'normal'): Phaser.GameObjects.NineSlice {
    const texture = style === 'judgment' ? UI.panelJudgment : UI.panel;
    return scene.add.nineslice(x, y, texture, undefined, width, height, SLICE.panel, SLICE.panel, SLICE.panel, SLICE.panel);
}
