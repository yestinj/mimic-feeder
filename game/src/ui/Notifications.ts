import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { Ability } from '../rules/abilities';
import { TIER_POINTS, type Achievement } from '../rules/achievements';
import { STRINGS } from '../strings';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { addAbilityIcon } from './AbilityBar';
import { Keycap } from './Keycap';
import { SLICE, UI, addPanel } from './kit';
import { TIER_TEXT_COLOURS, addMedal } from './Medal';
import { addText } from './text';

const BANNER_Y = 300;
const BANNER_HEIGHT = 157;
const BANNER_HOLD_MS = 1800;
/** The boss's entrance stays up a little longer. */
const BOSS_HOLD_MS = 2400;
/** The dungeon's warning stays up longer (4 s in all, as in the p5 game). */
const JUDGMENT_WARNING_HOLD_MS = 3500;
const TOAST_Y = 132;
/** Toasts sit lower while the boss bar is showing. */
const TOAST_Y_UNDER_BOSS_BAR = 150;
const TOAST_HOLD_MS = 2000;

interface Notice {
    title: string;
    detail?: string | undefined;
    /** Notices with the same key replace each other while queued (several level-ups at once show as the last). */
    readonly key?: string;
    /** An ability toast: its icon, name and key. */
    readonly ability?: Ability;
    /** An achievement toast: its medal, name and points. */
    readonly achievement?: Achievement;
    /** A banner in the Ninefold Judgment's colours, with a line under the title. */
    readonly judgment?: boolean;
    /** The boss's entrance: its name, large, with "Boss fight" above it. */
    readonly boss?: boolean;
}

/**
 * Big moments as banners in the upper third, smaller news as toasts at the
 * top (new abilities get their own card the first time; see UnlockScene).
 * Each kind shows one at a time from its own queue, without duplicates.
 * Everything here runs on the HUD scene's clock, so it waits while paused.
 */
export class Notifications {
    private readonly banners: Notice[] = [];
    private readonly toasts: Notice[] = [];
    private bannerShowing: Notice | null = null;
    private toastShowing: Notice | null = null;
    private readonly shown: Phaser.GameObjects.Container[] = [];
    private toastY = TOAST_Y;
    /** Held: nothing new shows and what's showing is hidden and frozen (during the judgment). */
    private held = false;

    constructor(private readonly scene: Phaser.Scene) {}

    banner(title: string): void {
        this.enqueue(this.banners, this.bannerShowing, { title }, () => this.nextBanner());
    }

    toast(title: string, detail?: string, key?: string): void {
        const queued = key ? this.toasts.find((notice) => notice.key === key) : undefined;
        if (queued) {
            queued.title = title;
            queued.detail = detail;
            return;
        }
        this.enqueue(this.toasts, this.toastShowing, { title, ...(detail ? { detail } : {}), ...(key ? { key } : {}) }, () => this.nextToast());
    }

    /** An ability unlocking again (in a later run): a toast with its icon, name and key. */
    abilityToast(ability: Ability): void {
        this.enqueue(this.toasts, this.toastShowing, { title: STRINGS.abilities[ability].name, ability }, () => this.nextToast());
    }

    /** An achievement unlocked: a toast with its medal, name and points. */
    achievementToast(achievement: Achievement): void {
        const name = STRINGS.achievements.list[achievement.id]?.name ?? achievement.id;
        this.enqueue(this.toasts, this.toastShowing, { title: STRINGS.achievements.unlocked, detail: name, achievement }, () => this.nextToast());
    }

    /** A boss arrives: its name on the banner, with `kicker` ("Boss fight") above, held a little longer. */
    bossCard(name: string, kicker: string): void {
        this.enqueue(this.banners, this.bannerShowing, { title: name, detail: kicker, boss: true }, () => this.nextBanner());
    }

    /** The dungeon's warning after five cats: a judgment-coloured banner. */
    judgmentWarning(title: string, detail: string): void {
        this.enqueue(this.banners, this.bannerShowing, { title, detail, key: 'catWarning', judgment: true }, () => this.nextBanner());
    }

    /** Removes a notice by key, showing or queued (the cat warning, once the judgment it warned of begins). */
    discard(key: string): void {
        for (const queue of [this.banners, this.toasts]) {
            for (let i = queue.length - 1; i >= 0; i--) {
                if (queue[i]?.key === key) {
                    queue.splice(i, 1);
                }
            }
        }
        if (this.bannerShowing?.key === key) {
            this.bannerShowing = null;
            this.finishShown('banner');
        }
    }

    /**
     * Holds notices (during the judgment): nothing new appears, and anything
     * showing is hidden and frozen. Released, everything carries on.
     */
    setHeld(held: boolean): void {
        if (held === this.held) {
            return;
        }
        this.held = held;
        for (const container of this.shown) {
            container.setVisible(!held);
            this.scene.tweens.getTweensOf(container).forEach((tween) => (held ? tween.pause() : tween.resume()));
        }
        if (!held) {
            if (!this.bannerShowing) {
                this.nextBanner();
            }
            if (!this.toastShowing) {
                this.nextToast();
            }
        }
    }

    /** True while a banner is showing or waiting to. */
    get bannersBusy(): boolean {
        return this.bannerShowing !== null || this.banners.length > 0;
    }

    /** Moves later toasts down out of the boss bar's way, or back. */
    makeRoomForBossBar(room: boolean): void {
        this.toastY = room ? TOAST_Y_UNDER_BOSS_BAR : TOAST_Y;
    }

    /** Drops everything, shown or queued (for game over). */
    clear(): void {
        this.banners.length = 0;
        this.toasts.length = 0;
        this.bannerShowing = null;
        this.toastShowing = null;
        for (const container of this.shown) {
            this.scene.tweens.killTweensOf(container);
            container.destroy();
        }
        this.shown.length = 0;
    }

    private enqueue(queue: Notice[], showing: Notice | null, notice: Notice, next: () => void): void {
        const same = (other: Notice | null): boolean => other?.title === notice.title && other.detail === notice.detail;
        if (same(showing) || queue.some(same)) {
            return;
        }
        queue.push(notice);
        if (!showing && !this.held) {
            next();
        }
    }

    /** Removes the banner or toast currently on screen at once. */
    private finishShown(kind: 'banner' | 'toast'): void {
        const container = this.shown.find((shown) => shown.getData('kind') === kind);
        if (container) {
            this.scene.tweens.killTweensOf(container);
            container.destroy();
            this.shown.splice(this.shown.indexOf(container), 1);
        }
        if (kind === 'banner' && !this.held) {
            this.nextBanner();
        }
    }

    private nextBanner(): void {
        if (this.held) {
            return;
        }
        const notice = this.banners.shift() ?? null;
        this.bannerShowing = notice;
        if (!notice) {
            return;
        }
        if (notice.judgment) {
            const title = addText(this.scene, 0, -24, notice.title, TYPE.title, { role: 'display', bold: true, colour: '#ffa6b2' }).setOrigin(0.5);
            const detail = addText(this.scene, 0, 40, notice.detail ?? '', TYPE.body, { colour: '#ebdce6' }).setOrigin(0.5);
            const panel = addPanel(this.scene, 0, 0, Math.max(760, title.width + SPACE.xl * 2), 170, 'judgment');
            this.show([panel, title, detail], BANNER_Y, JUDGMENT_WARNING_HOLD_MS, 0, () => this.nextBanner(), 'banner');
            return;
        }
        if (notice.boss) {
            const glow = this.scene.add.image(0, 0, UI.glow).setTint(COLOURS.ember).setDisplaySize(1100, 360).setAlpha(0.35);
            const kicker = addText(this.scene, 0, -50, (notice.detail ?? '').toUpperCase(), TYPE.small, { bold: true, colour: '#ff8f80', letterSpacing: 8 }).setOrigin(0.5);
            const name = addText(this.scene, 0, 12, notice.title, TYPE.banner, { role: 'display', bold: true, colour: '#ffcf9a' }).setOrigin(0.5);
            const ribbon = this.scene.add.nineslice(0, 6, UI.banner, undefined, Math.max(820, name.width + SLICE.banner * 2 + SPACE.l), BANNER_HEIGHT + 30, SLICE.banner, SLICE.banner);
            this.show([glow, ribbon, kicker, name], BANNER_Y, BOSS_HOLD_MS, 0, () => this.nextBanner(), 'banner');
            return;
        }
        const text = addText(this.scene, 0, -2, notice.title, TYPE.banner, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const ribbon = this.scene.add.nineslice(0, 0, UI.banner, undefined, Math.max(720, text.width + SLICE.banner * 2 + SPACE.l), BANNER_HEIGHT, SLICE.banner, SLICE.banner);
        this.show([ribbon, text], BANNER_Y, BANNER_HOLD_MS, 0, () => this.nextBanner(), 'banner');
    }

    private nextToast(): void {
        if (this.held) {
            return;
        }
        const notice = this.toasts.shift() ?? null;
        this.toastShowing = notice;
        if (!notice) {
            return;
        }
        if (notice.ability) {
            this.showAbilityToast(notice.ability);
            return;
        }
        if (notice.achievement) {
            this.showAchievementToast(notice.achievement);
            return;
        }
        const title = addText(this.scene, 0, notice.detail ? -22 : 0, notice.title, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const parts: Phaser.GameObjects.GameObject[] = [];
        let width = title.width;
        if (notice.detail) {
            const detail = addText(this.scene, 0, 28, notice.detail, TYPE.body, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
            width = Math.max(width, detail.width);
            parts.push(detail);
        }
        const panel = addPanel(this.scene, 0, 0, Math.max(360, width + SPACE.xl * 1.5), notice.detail ? 136 : 96);
        this.show([panel, title, ...parts], this.toastY, TOAST_HOLD_MS, -24, () => this.nextToast(), 'toast');
    }

    /** [icon] Name [Key], in the toast spot. */
    private showAbilityToast(ability: Ability): void {
        const info = STRINGS.abilities[ability];
        const iconSize = 64;
        const name = addText(this.scene, 0, 0, info.name, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0, 0.5);
        const keycap = new Keycap(this.scene, 0, 0, info.key, 48);
        const width = SPACE.l * 2 + iconSize + SPACE.m + name.width + SPACE.m + keycap.width;
        const left = -width / 2 + SPACE.l;
        const slot = this.scene.add.image(left + iconSize / 2, 0, UI.abilitySlot).setDisplaySize(iconSize, iconSize);
        const icon = addAbilityIcon(this.scene, left + iconSize / 2, -2, ability, iconSize * 0.64);
        name.x = left + iconSize + SPACE.m;
        keycap.x = name.x + name.width + SPACE.m + keycap.width / 2;
        const panel = addPanel(this.scene, 0, 0, width, 96);
        this.show([panel, slot, icon, name, keycap], this.toastY, TOAST_HOLD_MS, -24, () => this.nextToast(), 'toast');
    }

    /** [medal] "Achievement Unlocked!" over its name and points, in the toast spot. */
    private showAchievementToast(achievement: Achievement): void {
        const medalSize = 84;
        const tierText = TIER_TEXT_COLOURS[achievement.tier];
        const heading = addText(this.scene, 0, -24, STRINGS.achievements.unlocked, TYPE.small, { bold: true, colour: TEXT_COLOURS.muted, letterSpacing: 1 })
            .setOrigin(0, 0.5);
        const name = addText(this.scene, 0, 16, STRINGS.achievements.list[achievement.id]?.name ?? achievement.id, TYPE.heading, { role: 'display', bold: true, colour: tierText })
            .setOrigin(0, 0.5);
        const points = addText(this.scene, 0, 18, STRINGS.achievements.points(TIER_POINTS[achievement.tier]), TYPE.body, { bold: true, colour: tierText })
            .setOrigin(0, 0.5);
        const textWidth = Math.max(heading.width, name.width + SPACE.s + points.width);
        const width = SPACE.l * 2 + medalSize + SPACE.m + textWidth;
        const left = -width / 2 + SPACE.l;
        const medal = addMedal(this.scene, left + medalSize / 2, 0, achievement, 'unlocked', medalSize);
        heading.x = left + medalSize + SPACE.m;
        name.x = heading.x;
        points.x = name.x + name.width + SPACE.s;
        const panel = addPanel(this.scene, 0, 0, width, 124);
        this.show([panel, medal, heading, name, points], this.toastY + 14, TOAST_HOLD_MS + 500, -24, () => this.nextToast(), 'toast');
    }

    /** Fades a notice in (sliding by `slide`), holds it, fades it out, then calls `done`. */
    private show(parts: Phaser.GameObjects.GameObject[], y: number, holdMs: number, slide: number, done: () => void, kind: 'banner' | 'toast'): void {
        const container = this.scene.add.container(DESIGN_WIDTH / 2, y + slide, parts).setAlpha(0).setScale(slide ? 1 : 0.9);
        container.setData('kind', kind);
        this.shown.push(container);
        this.scene.tweens.add({ targets: container, alpha: 1, y, scale: 1, duration: MOTION.normal, ease: 'Back.Out' });
        this.scene.tweens.add({
            targets: container,
            alpha: 0,
            delay: MOTION.normal + holdMs,
            duration: MOTION.fade,
            ease: 'Sine.In',
            onComplete: () => {
                container.destroy();
                const index = this.shown.indexOf(container);
                if (index >= 0) {
                    this.shown.splice(index, 1);
                }
                done();
            },
        });
    }
}
