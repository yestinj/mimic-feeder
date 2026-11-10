// Small UI helpers shared by the HUD and overlays.
import { THEME } from './config.js';

const RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);

export function text(scene, x, y, value, size, color = THEME.text, extra = {}) {
    return scene.add.text(x, y, value, {
        fontFamily: THEME.font,
        fontSize: `${size}px`,
        color,
        resolution: RESOLUTION,
        ...extra
    });
}

// Dark translucent panel with a soft drop shadow, a thin gold border and a
// faint highlight along the top edge.
export function drawPanel(g, x, y, w, h, radius = 14) {
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x + 2, y + 4, w, h, radius);
    g.fillStyle(THEME.panel, THEME.panelAlpha);
    g.fillRoundedRect(x, y, w, h, radius);
    g.lineStyle(1.5, THEME.border, 0.85);
    g.strokeRoundedRect(x, y, w, h, radius);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(x + radius, y + 2, x + w - radius, y + 2);
    return g;
}

export function button(scene, x, y, label, onClick) {
    const w = 200;
    const h = 52;
    const bg = scene.add.graphics();
    const paint = (hover) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.35);
        bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 12);
        bg.fillStyle(hover ? 0x8a5a26 : 0x6b4420, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        bg.lineStyle(2, THEME.goldHex, hover ? 1 : 0.8);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    paint(false);
    const label_ = text(scene, 0, 0, label, 22, THEME.gold, { fontStyle: 'bold' }).setOrigin(0.5);
    const container = scene.add.container(x, y, [bg, label_]);
    container.setSize(w, h).setInteractive({ useHandCursor: true });
    container.on('pointerover', () => {
        paint(true);
        scene.tweens.add({ targets: container, scale: 1.05, duration: 120 });
    });
    container.on('pointerout', () => {
        paint(false);
        scene.tweens.add({ targets: container, scale: 1, duration: 120 });
    });
    container.on('pointerdown', onClick);
    return container;
}
