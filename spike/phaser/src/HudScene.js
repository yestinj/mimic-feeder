import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, THEME } from './config.js';
import { drawPanel, text, button } from './ui.js';

// Runs on top of PlayScene: HUD panels, floating numbers, banners, and the
// start / pause / game-over overlays. Pausing stops PlayScene entirely, so no
// gameplay input or simulation can run under an overlay.
export class HudScene extends Phaser.Scene {
    constructor() {
        super('hud');
    }

    create() {
        this.playScene = this.scene.get('play');
        this.shownScore = 0;
        this.bannerQueue = [];
        this.bannerBusy = false;
        this.overlay = null;
        this.blur = null;

        this.buildScorePanel();
        this.buildStatusPanel();
        this.hint = text(this, 20, HEIGHT - 44, '←  →  move     ↑  jump (twice)     P  pause     M  mute', 15, THEME.muted)
            .setShadow(1, 1, '#000', 3);

        const ev = this.game.events;
        const handlers = {
            stats: (s) => this.onStats(s),
            float: (f) => this.floatText(f),
            banner: (b) => this.queueBanner(b),
            gameover: (s) => this.showGameOver(s)
        };
        for (const [name, fn] of Object.entries(handlers)) {
            ev.on(name, fn);
        }
        this.events.once('shutdown', () => {
            for (const [name, fn] of Object.entries(handlers)) {
                ev.off(name, fn);
            }
        });

        const kb = this.input.keyboard;
        kb.on('keydown-P', () => this.togglePause());
        kb.on('keydown-M', () => {
            this.sound.mute = !this.sound.mute;
            this.muteLabel.setVisible(this.sound.mute);
        });
        kb.on('keydown-ENTER', () => this.overlay?.confirm?.());
        this.muteLabel = text(this, WIDTH - 20, HEIGHT - 44, 'Muted', 15, THEME.gold).setOrigin(1, 0).setVisible(false);

        this.onStats(this.playScene.state);
        this.showStart();
    }

    // ── HUD panels ──────────────────────────────────────────────────────

    buildScorePanel() {
        drawPanel(this.add.graphics(), 16, 16, 220, 104);
        text(this, 34, 28, 'SCORE', 13, THEME.muted, { fontStyle: 'bold', letterSpacing: 3 });
        this.scoreText = text(this, 34, 44, '0', 38, THEME.gold, { fontStyle: 'bold' }).setShadow(0, 2, '#000', 4);
        this.zoneText = text(this, 34, 92, '', 15, THEME.text);
    }

    buildStatusPanel() {
        const w = 260;
        const x = WIDTH - 16 - w;
        drawPanel(this.add.graphics(), x, 16, w, 104);
        this.hearts = [];
        this.heartX = x + 20;
        this.heartY = 40;

        // Level badge
        const badge = this.add.graphics();
        badge.fillStyle(0x2a1a10, 1).fillCircle(x + w - 40, 48, 22);
        badge.lineStyle(2, THEME.goldHex, 1).strokeCircle(x + w - 40, 48, 22);
        text(this, x + w - 40, 36, 'LV', 10, THEME.muted, { fontStyle: 'bold', letterSpacing: 2 }).setOrigin(0.5, 0);
        this.levelText = text(this, x + w - 40, 47, '1', 20, THEME.gold, { fontStyle: 'bold' }).setOrigin(0.5, 0);

        // XP bar
        this.xpBar = { x: x + 20, y: 80, w: w - 40, h: 10, value: 0 };
        this.xpGfx = this.add.graphics();
        this.xpText = text(this, x + 20, 92, '', 12, THEME.muted);
        text(this, x + 20, 62, 'XP', 12, THEME.muted, { fontStyle: 'bold', letterSpacing: 2 });
    }

    drawXp() {
        const b = this.xpBar;
        const g = this.xpGfx.clear();
        g.fillStyle(0x2a1a10, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 5);
        if (b.value > 0) {
            g.fillStyle(THEME.xp, 1).fillRoundedRect(b.x, b.y, Math.max(b.h, b.w * b.value), b.h, 5);
            g.fillStyle(0xffffff, 0.25).fillRoundedRect(b.x + 2, b.y + 1, Math.max(b.h - 4, b.w * b.value - 4), 3, 2);
        }
    }

    onStats(s) {
        // Score counts up instead of jumping.
        this.tweens.add({
            targets: this, shownScore: s.score, duration: 400, ease: 'Cubic.Out',
            onUpdate: () => this.scoreText.setText(Math.round(this.shownScore).toLocaleString())
        });
        if (s.score > (this.lastScore ?? 0)) {
            this.tweens.add({ targets: this.scoreText, scale: 1.12, duration: 90, yoyo: true });
        }
        this.lastScore = s.score;
        this.zoneText.setText(`Floor ${s.floor}  ·  Zone ${s.zone}`);

        if (this.levelText.text !== String(s.level)) {
            this.levelText.setText(String(s.level));
            this.tweens.add({ targets: this.levelText, scale: 1.4, duration: 160, yoyo: true });
        }
        this.tweens.add({
            targets: this.xpBar, value: s.xp / s.xpCap, duration: 350, ease: 'Cubic.Out',
            onUpdate: () => this.drawXp()
        });
        this.drawXp();
        this.xpText.setText(`${s.xp} / ${s.xpCap}`);
        this.updateHearts(s);
    }

    updateHearts(s) {
        while (this.hearts.length < s.maxLives) {
            const i = this.hearts.length;
            this.hearts.push(this.add.image(this.heartX + i * 30 + 12, this.heartY, 'heart'));
        }
        this.hearts.forEach((h, i) => {
            const full = i < s.lives;
            if (h.full === true && !full) {
                // Lost heart: pop, then fade to an empty socket.
                this.tweens.add({ targets: h, scale: 1.6, duration: 120, yoyo: true });
            }
            h.full = full;
            h.setTint(full ? THEME.danger : 0x3b2a20);
        });
    }

    // ── Feedback ────────────────────────────────────────────────────────

    floatText({ x, y, text: value, color = THEME.gold }) {
        const t = text(this, x, y, value, 24, color, { fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 5 }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    }

    queueBanner(b) {
        this.bannerQueue.push(b);
        this.nextBanner();
    }

    nextBanner() {
        if (this.bannerBusy || this.bannerQueue.length === 0) {
            return;
        }
        this.bannerBusy = true;
        const { title, subtitle } = this.bannerQueue.shift();
        const y = HEIGHT * 0.3;
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.5).fillRect(0, y - 52, WIDTH, 104);
        g.lineStyle(1, THEME.border, 0.7).lineBetween(0, y - 52, WIDTH, y - 52).lineBetween(0, y + 52, WIDTH, y + 52);
        const t1 = text(this, WIDTH / 2, y - 12, title, 44, THEME.gold, { fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 6 }).setOrigin(0.5);
        const t2 = text(this, WIDTH / 2, y + 30, subtitle, 18, THEME.text).setOrigin(0.5);
        const parts = [g, t1, t2];
        parts.forEach((p) => p.setAlpha(0));
        t1.setScale(0.8);
        this.tweens.add({ targets: parts, alpha: 1, duration: 220 });
        this.tweens.add({ targets: t1, scale: 1, duration: 300, ease: 'Back.Out' });
        this.tweens.add({
            targets: parts, alpha: 0, delay: 1500, duration: 300,
            onComplete: () => {
                parts.forEach((p) => p.destroy());
                this.bannerBusy = false;
                this.nextBanner();
            }
        });
    }

    // ── Overlays ────────────────────────────────────────────────────────

    setBlur(on) {
        const filters = this.playScene.cameras.main.filters.internal;
        if (on && !this.blur) {
            this.blur = filters.addBlur(1, 2, 2, 1);
        } else if (!on && this.blur) {
            filters.remove(this.blur);
            this.blur = null;
        }
    }

    openOverlay({ title, lines, action, onConfirm }) {
        this.closeOverlay();
        this.setBlur(true);
        const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.45);
        const w = 480;
        const h = 150 + lines.length * 30 + (action ? 70 : 0);
        const x = (WIDTH - w) / 2;
        const y = (HEIGHT - h) / 2;
        const panel = drawPanel(this.add.graphics(), x, y, w, h, 18);
        const parts = [dim, panel];
        parts.push(text(this, WIDTH / 2, y + 34, title, 40, THEME.gold, { fontStyle: 'bold' }).setOrigin(0.5, 0));
        lines.forEach((line, i) => {
            parts.push(text(this, WIDTH / 2, y + 100 + i * 30, line, 18, THEME.text).setOrigin(0.5, 0));
        });
        if (action) {
            parts.push(button(this, WIDTH / 2, y + h - 56, action, onConfirm));
        }
        const container = this.add.container(0, 0, parts).setAlpha(0);
        this.tweens.add({ targets: container, alpha: 1, duration: 200 });
        this.overlay = { container, confirm: onConfirm };
    }

    closeOverlay() {
        if (this.overlay) {
            this.overlay.container.destroy();
            this.overlay = null;
        }
        this.setBlur(false);
    }

    showStart() {
        this.openOverlay({
            title: 'Mimic Feeder',
            lines: ['Feed the mimic. Dodge the bombs.', 'Don\'t let anything hit the floor.'],
            action: 'Start',
            onConfirm: () => {
                this.closeOverlay();
                this.playScene.begin();
                this.tweens.add({ targets: this.hint, alpha: 0, delay: 8000, duration: 800 });
            }
        });
    }

    togglePause() {
        if (!this.playScene.running || this.playScene.over) {
            return;
        }
        if (this.scene.isPaused('play')) {
            this.closeOverlay();
            this.scene.resume('play');
            this.playScene.music.resume();
        } else {
            this.scene.pause('play');
            this.playScene.music.pause();
            this.openOverlay({ title: 'Paused', lines: ['Press P to resume'], action: null });
        }
    }

    showGameOver(s) {
        this.openOverlay({
            title: 'Game Over',
            lines: [`Score  ${s.score.toLocaleString()}`, `Level ${s.level}  ·  Zone ${s.zone}  ·  ${s.eaten} eaten`],
            action: 'Try again',
            onConfirm: () => {
                this.closeOverlay();
                this.playScene.scene.restart();
                this.playScene.events.once('create', () => {
                    this.shownScore = 0;
                    this.lastScore = 0;
                    this.onStats(this.playScene.state);
                    this.playScene.begin();
                });
            }
        });
    }
}
