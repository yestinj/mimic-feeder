import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, THEME } from './config.js';
import { drawPanel, text } from './ui.js';

const SOUNDS = ['collect', 'explode', 'lose_life', 'jump', 'double_jump', 'game_over', 'player_level_up', 'level_complete'];
const PIXEL_ART = ['human', 'goblin', 'elf', 'small_bomb'];

export class BootScene extends Phaser.Scene {
    constructor() {
        super('boot');
    }

    preload() {
        // A real loading screen: progress bar driven by the loader.
        const g = this.add.graphics();
        const barW = 360;
        const x = (WIDTH - barW) / 2;
        const y = HEIGHT / 2;
        drawPanel(g, x - 24, y - 56, barW + 48, 104);
        text(this, WIDTH / 2, y - 30, 'Waking the mimic…', 20, THEME.gold).setOrigin(0.5);
        const fill = this.add.graphics();
        this.load.on('progress', (p) => {
            fill.clear();
            fill.fillStyle(0x2a1a10, 1).fillRoundedRect(x, y + 4, barW, 14, 7);
            fill.fillStyle(THEME.goldHex, 1).fillRoundedRect(x, y + 4, Math.max(14, barW * p), 14, 7);
        });

        // The spike is served from /spike/phaser/ and reuses the game's assets.
        this.load.setPath('../../assets/');
        this.load.image('bg', 'backgrounds/upper-dungeon.webp');
        this.load.image('chest_closed', 'chest_closed.png');
        this.load.image('chest_ajar', 'chest_ajar.png');
        this.load.image('chest_open', 'chest_open.png');
        for (const key of PIXEL_ART) {
            this.load.image(key, `${key}.png`);
        }
        for (let i = 1; i <= 7; i++) {
            this.load.image(`boom${i}`, `bomb_explosion/frame${i}.png`);
        }
        for (let i = 0; i < 12; i++) {
            this.load.image(`splat${i}`, `humanoid_splat/frame${String(i).padStart(4, '0')}.png`);
        }
        for (const key of SOUNDS) {
            this.load.audio(key, `${key}.mp3`);
        }
        this.load.audio('music', 'music/background1.mp3');
    }

    create() {
        for (const key of PIXEL_ART) {
            this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }

        this.anims.create({
            key: 'boom',
            frames: Array.from({ length: 7 }, (_, i) => ({ key: `boom${i + 1}` })),
            frameRate: 18
        });
        this.anims.create({
            key: 'splat',
            frames: Array.from({ length: 12 }, (_, i) => ({ key: `splat${i}` })),
            frameRate: 20
        });

        this.makeTextures();
        this.scene.start('play');
        this.scene.launch('hud');
    }

    // Generated textures for UI and particles, so the spike needs no new art.
    makeTextures() {
        const g = this.make.graphics({ x: 0, y: 0 }, false);

        g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
        g.generateTexture('spark', 16, 16);
        g.clear();

        // Heart: two circles and a triangle, drawn white so it can be tinted.
        g.fillStyle(0xffffff, 1);
        g.fillCircle(7, 7, 7);
        g.fillCircle(17, 7, 7);
        g.fillTriangle(0.6, 9.5, 23.4, 9.5, 12, 22);
        g.generateTexture('heart', 24, 23);
        g.destroy();
    }
}
