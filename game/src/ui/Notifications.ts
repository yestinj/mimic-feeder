import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { Ability } from '../rules/abilities';
import { STRINGS } from '../strings';
import { MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { addAbilityIcon } from './AbilityBar';
import { Keycap } from './Keycap';
import { SLICE, UI, addPanel } from './kit';
import { addText } from './text';

const BANNER_Y = 300;
const BANNER_HEIGHT = 157;
const BANNER_HOLD_MS = 1800;
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
        if (!showing) {
            next();
        }
    }

    private nextBanner(): void {
        const notice = this.banners.shift() ?? null;
        this.bannerShowing = notice;
        if (!notice) {
            return;
        }
        const text = addText(this.scene, 0, -2, notice.title, TYPE.banner, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const ribbon = this.scene.add.nineslice(0, 0, UI.banner, undefined, Math.max(720, text.width + SLICE.banner * 2 + SPACE.l), BANNER_HEIGHT, SLICE.banner, SLICE.banner);
        this.show([ribbon, text], BANNER_Y, BANNER_HOLD_MS, 0, () => this.nextBanner());
    }

    private nextToast(): void {
        const notice = this.toasts.shift() ?? null;
        this.toastShowing = notice;
        if (!notice) {
            return;
        }
        if (notice.ability) {
            this.showAbilityToast(notice.ability);
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
        this.show([panel, title, ...parts], this.toastY, TOAST_HOLD_MS, -24, () => this.nextToast());
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
        this.show([panel, slot, icon, name, keycap], this.toastY, TOAST_HOLD_MS, -24, () => this.nextToast());
    }

    /** Fades a notice in (sliding by `slide`), holds it, fades it out, then calls `done`. */
    private show(parts: Phaser.GameObjects.GameObject[], y: number, holdMs: number, slide: number, done: () => void): void {
        const container = this.scene.add.container(DESIGN_WIDTH / 2, y + slide, parts).setAlpha(0).setScale(slide ? 1 : 0.9);
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
