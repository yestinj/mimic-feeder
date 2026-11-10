import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import type { Ability } from '../rules/abilities';
import { STRINGS } from '../strings';
import { MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { ABILITY_ICONS } from './AbilityBar';
import { Keycap } from './Keycap';
import { SLICE, UI, addPanel } from './kit';
import { addText } from './text';

const BANNER_Y = 300;
const BANNER_HEIGHT = 157;
const BANNER_HOLD_MS = 1800;
const TOAST_Y = 132;
const TOAST_HOLD_MS = 2000;
const UNLOCK_Y = 540;
const UNLOCK_HOLD_MS = 4000;

interface Notice {
    title: string;
    detail?: string | undefined;
    /** Notices with the same key replace each other while queued (several level-ups at once show as the last). */
    readonly key?: string;
}

/**
 * Big moments as banners in the upper third, new abilities as larger unlock
 * notices mid-screen, smaller news as toasts at the top. Each kind shows one
 * at a time from its own queue, without duplicates. Everything here runs on
 * the HUD scene's clock, so it waits while paused.
 */
export class Notifications {
    private readonly banners: Notice[] = [];
    private readonly toasts: Notice[] = [];
    private readonly unlocks: Notice[] = [];
    private bannerShowing: Notice | null = null;
    private toastShowing: Notice | null = null;
    private unlockShowing: Notice | null = null;
    private readonly shown: Phaser.GameObjects.Container[] = [];

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

    /** A newly unlocked ability: its icon, name and the key to press. */
    unlock(ability: Ability): void {
        this.enqueue(this.unlocks, this.unlockShowing, { title: ability }, () => this.nextUnlock());
    }

    /** Drops everything, shown or queued (for game over). */
    clear(): void {
        this.banners.length = 0;
        this.toasts.length = 0;
        this.unlocks.length = 0;
        this.bannerShowing = null;
        this.toastShowing = null;
        this.unlockShowing = null;
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
        const title = addText(this.scene, 0, notice.detail ? -22 : 0, notice.title, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const parts: Phaser.GameObjects.GameObject[] = [];
        let width = title.width;
        if (notice.detail) {
            const detail = addText(this.scene, 0, 28, notice.detail, TYPE.body, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
            width = Math.max(width, detail.width);
            parts.push(detail);
        }
        const panel = addPanel(this.scene, 0, 0, Math.max(360, width + SPACE.xl * 1.5), notice.detail ? 136 : 96);
        this.show([panel, title, ...parts], TOAST_Y, TOAST_HOLD_MS, -24, () => this.nextToast());
    }

    private nextUnlock(): void {
        const notice = this.unlocks.shift() ?? null;
        this.unlockShowing = notice;
        if (!notice) {
            return;
        }
        const ability = notice.title as Ability;
        const info = STRINGS.abilities[ability];
        const scene = this.scene;

        const label = addText(scene, 0, -70, STRINGS.notices.unlocked.toUpperCase(), TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true }).setOrigin(0, 0.5);
        const title = addText(scene, 0, -24, info.name, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0, 0.5);
        const press = addText(scene, 0, 50, STRINGS.notices.press, TYPE.body).setOrigin(0, 0.5);
        const keycap = new Keycap(scene, 0, 50, info.key, 56);
        const use = addText(scene, 0, 50, info.use, TYPE.body).setOrigin(0, 0.5);
        const rowWidth = press.width + SPACE.s + keycap.width + SPACE.s + use.width;

        const iconSize = 128;
        const margin = SPACE.xl;
        const textWidth = Math.max(title.width, label.width, rowWidth);
        const width = Math.max(760, margin * 2 + iconSize + SPACE.l + textWidth);
        const height = 220;
        const left = -width / 2 + margin;
        const textX = left + iconSize + SPACE.l;
        label.x = textX;
        title.x = textX;
        press.x = textX;
        keycap.x = textX + press.width + SPACE.s + keycap.width / 2;
        use.x = keycap.x + keycap.width / 2 + SPACE.s;

        const panel = addPanel(scene, 0, 0, width, height);
        const slot = scene.add.image(left + iconSize / 2, 0, UI.abilitySlot).setDisplaySize(iconSize, iconSize);
        const icon = scene.add.image(left + iconSize / 2, -4, ABILITY_ICONS[ability]).setDisplaySize(iconSize * 0.64, iconSize * 0.64);
        scene.tweens.add({ targets: keycap, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.show([panel, slot, icon, label, title, press, keycap, use], UNLOCK_Y, UNLOCK_HOLD_MS, 0, () => this.nextUnlock());
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
