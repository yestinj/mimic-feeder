import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import { MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { SLICE, UI, addPanel } from './kit';
import { addText } from './text';

const BANNER_Y = 300;
const BANNER_HEIGHT = 157;
const BANNER_HOLD_MS = 1800;
const TOAST_Y = 132;
const TOAST_HOLD_MS = 2000;

interface Notice {
    readonly title: string;
    readonly detail?: string;
}

/**
 * Big moments as banners in the upper third, smaller news as toasts at the
 * top. Each kind shows one at a time from its own queue, without duplicates.
 * Everything here runs on the HUD scene's clock, so it waits while paused.
 */
export class Notifications {
    private readonly banners: Notice[] = [];
    private readonly toasts: Notice[] = [];
    private bannerShowing: Notice | null = null;
    private toastShowing: Notice | null = null;
    private readonly shown: Phaser.GameObjects.Container[] = [];

    constructor(private readonly scene: Phaser.Scene) {}

    banner(title: string): void {
        this.enqueue(this.banners, this.bannerShowing, { title }, () => this.nextBanner());
    }

    toast(title: string, detail?: string): void {
        this.enqueue(this.toasts, this.toastShowing, detail ? { title, detail } : { title }, () => this.nextToast());
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
