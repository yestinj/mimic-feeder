import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, GROUND_Y, PLAYER, OBJECTS, CREATURES, LIVES, XP_CAP, EATEN_PER_ZONE } from './config.js';

// The gameplay slice: the mimic, falling creatures and bombs. Everything the
// player reads (score, hearts, XP, banners, overlays) lives in HudScene, which
// listens for the events this scene emits on game.events.
export class PlayScene extends Phaser.Scene {
    constructor() {
        super('play');
    }

    create() {
        this.state = {
            score: 0, xp: 0, xpCap: XP_CAP, level: 1, lives: LIVES, maxLives: LIVES,
            floor: 1, zone: 1, eaten: 0, dropScale: 1, spawnMs: OBJECTS.spawnMs,
            speedPct: 100, sizePct: 100
        };
        this.running = false;
        this.over = false;
        this.spawnClock = 1200; // first drop arrives quickly
        this.objects = [];

        this.add.image(WIDTH / 2, HEIGHT / 2, 'bg').setDisplaySize(WIDTH, HEIGHT);
        this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.95, 0.45);

        // The mimic is drawn from its bottom-centre so lid changes keep it grounded.
        this.playerShadow = this.add.ellipse(WIDTH / 2, GROUND_Y - 2, 100, 16, 0x000000, 0.45);
        this.player = this.add.image(WIDTH / 2, GROUND_Y, 'chest_closed').setOrigin(0.5, 1);
        this.p = { x: WIDTH / 2, y: GROUND_Y, vy: 0, jumps: 0, airborne: false, openMs: 0 };
        this.squash = { x: 1, y: 1 };
        this.applyPlayerScale();

        this.sparks = this.add.particles(0, 0, 'spark', {
            lifespan: 700,
            speed: { min: 140, max: 340 },
            angle: { min: 200, max: 340 },
            gravityY: 600,
            scale: { start: 0.35, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: [0xffdb7e, 0xfff3c4, 0xffa94d],
            blendMode: 'ADD',
            emitting: false
        });
        this.dust = this.add.particles(0, 0, 'spark', {
            lifespan: 420,
            speed: { min: 30, max: 90 },
            angle: { min: 180, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0x8c7357,
            emitting: false
        });

        const kb = this.input.keyboard;
        this.keys = kb.addKeys('LEFT,RIGHT,UP,A,D,W');
        kb.on('keydown-UP', () => this.jump());
        kb.on('keydown-W', () => this.jump());

        this.music = this.sound.add('music', { loop: true, volume: 0.35 });
        this.events.once('shutdown', () => this.music.stop());
        this.emitStats();
    }

    begin() {
        this.running = true;
        if (!this.music.isPlaying) {
            this.music.play();
        }
    }

    applyPlayerScale() {
        const base = PLAYER.scale * (this.state.sizePct / 100);
        this.player.setScale(base * this.squash.x, base * this.squash.y);
        // Hitbox comes from the closed chest so opening the lid doesn't change it.
        const src = this.textures.get('chest_closed').getSourceImage();
        this.p.w = src.width * base;
        this.p.h = src.height * base;
    }

    jump() {
        if (!this.running || this.over || this.p.jumps >= PLAYER.maxJumps) {
            return;
        }
        this.p.vy = PLAYER.jump * Math.pow(1.03, this.state.level - 1);
        this.p.jumps += 1;
        this.p.airborne = true;
        this.sound.play(this.p.jumps === 1 ? 'jump' : 'double_jump', { volume: 0.6 });
        this.tweens.add({ targets: this.squash, x: 0.9, y: 1.12, duration: 90, yoyo: true });
    }

    update(_time, deltaMs) {
        const dt = Math.min(deltaMs, 50) / 1000;
        this.updatePlayer(dt);
        this.applyPlayerScale();
        if (!this.running || this.over) {
            return;
        }
        this.spawnClock -= deltaMs;
        if (this.spawnClock <= 0) {
            this.spawnClock = this.state.spawnMs;
            this.spawn();
        }
        this.updateObjects(dt);
    }

    updatePlayer(dt) {
        const p = this.p;
        const k = this.keys;
        const left = k.LEFT.isDown || k.A.isDown;
        const right = k.RIGHT.isDown || k.D.isDown;
        const speed = PLAYER.speed * (this.state.speedPct / 100);
        if (this.running && !this.over) {
            if (left) p.x -= speed * dt;
            if (right) p.x += speed * dt;
        }
        p.x = Phaser.Math.Clamp(p.x, p.w / 2, WIDTH - p.w / 2);

        p.vy += PLAYER.gravity * dt;
        p.y += p.vy * dt;
        if (p.y >= GROUND_Y) {
            if (p.airborne && p.vy > 300) {
                this.tweens.add({ targets: this.squash, x: 1.14, y: 0.86, duration: 80, yoyo: true });
                this.dust.explode(10, p.x, GROUND_Y - 4);
            }
            p.y = GROUND_Y;
            p.vy = 0;
            p.jumps = 0;
            p.airborne = false;
        }
        p.openMs = Math.max(0, p.openMs - dt * 1000);

        // Lid: open to eat, ajar while moving or jumping, closed at rest.
        let key = 'chest_closed';
        if (p.openMs > 0 || this.foodNearby()) {
            key = 'chest_open';
        } else if (p.airborne || ((left || right) && this.running)) {
            key = 'chest_ajar';
        }
        this.player.setTexture(key).setPosition(p.x, p.y);

        const height = GROUND_Y - p.y;
        const shadowScale = Phaser.Math.Clamp(1 - height / 400, 0.4, 1);
        this.playerShadow.setPosition(p.x, GROUND_Y - 2).setScale(shadowScale * (p.w / 100), 1).setAlpha(0.45 * shadowScale);
    }

    playerRect(pad = 0) {
        const { x, y, w, h } = this.p;
        return new Phaser.Geom.Rectangle(x - w / 2 - pad, y - h - pad, w + pad * 2, h + pad * 2);
    }

    foodNearby() {
        const r = this.playerRect(PLAYER.nearby);
        return this.objects.some((o) => !o.bomb && Phaser.Geom.Intersects.RectangleToRectangle(r, o.sprite.getBounds()));
    }

    spawn() {
        const bomb = Math.random() < OBJECTS.bombChance;
        const kind = bomb ? { key: 'small_bomb', xp: 0 } : this.pickCreature();
        const x = Phaser.Math.Between(60, WIDTH - 60);
        const sprite = this.add.image(x, -40, kind.key);
        const scale = OBJECTS.height / sprite.height * (bomb ? 0.9 : 1);
        sprite.setScale(scale);
        const shadow = this.add.ellipse(x, GROUND_Y - 2, sprite.displayWidth * 0.7, 10, 0x000000, 0);
        this.children.moveBelow(shadow, this.player);
        const vy = OBJECTS.baseDrop * this.state.dropScale * Phaser.Math.FloatBetween(0.75, 1.25);
        const obj = { sprite, shadow, bomb, xp: kind.xp, vx: 0, vy, spin: bomb ? Phaser.Math.FloatBetween(-2, 2) : 0, sway: Math.random() * Math.PI * 2 };
        this.objects.push(obj);
        // Small pop-in so new drops catch the eye.
        sprite.setAlpha(0);
        this.tweens.add({ targets: sprite, alpha: 1, duration: 250 });
    }

    pickCreature() {
        let roll = Math.random();
        for (const c of CREATURES) {
            roll -= c.weight;
            if (roll <= 0) return c;
        }
        return CREATURES[0];
    }

    updateObjects(dt) {
        const player = this.playerRect();
        const mouthBottom = player.y + player.height * PLAYER.eatZone;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            const s = o.sprite;
            o.sway += dt * 3;
            if (o.vx !== 0) {
                o.vy += 900 * dt; // bumped objects arc away
                o.vx *= 0.99;
            }
            s.x += o.vx * dt;
            s.y += o.vy * dt;
            s.rotation = o.bomb ? s.rotation + o.spin * dt : Math.sin(o.sway) * 0.12;

            const lift = GROUND_Y - (s.y + s.displayHeight / 2);
            o.shadow.setPosition(s.x, GROUND_Y - 2).setAlpha(Phaser.Math.Clamp(0.35 - lift / 1600, 0, 0.35));

            const b = s.getBounds();
            if (Phaser.Geom.Intersects.RectangleToRectangle(player, b)) {
                if (o.bomb) {
                    this.explode(o, i, true);
                } else if (o.vy > 0 && b.bottom > player.y && b.top < mouthBottom && b.centerX > player.left && b.centerX < player.right) {
                    this.eat(o, i);
                } else if (o.vx === 0) {
                    o.vx = Math.sign(s.x - this.p.x || 1) * 260;
                    o.vy = -260;
                }
                continue;
            }
            if (b.bottom >= GROUND_Y) {
                if (o.bomb) {
                    this.explode(o, i, false);
                } else {
                    this.splat(o, i);
                }
            } else if (s.x < -80 || s.x > WIDTH + 80) {
                this.remove(i);
            }
        }
    }

    remove(i) {
        const [o] = this.objects.splice(i, 1);
        o.sprite.destroy();
        o.shadow.destroy();
    }

    eat(o, i) {
        const { x, y } = o.sprite;
        this.remove(i);
        this.p.openMs = 260;
        this.sparks.explode(14, x, y);
        this.sound.play('collect', { volume: 0.7 });
        this.tweens.add({ targets: this.squash, x: 1.1, y: 0.92, duration: 70, yoyo: true });

        const st = this.state;
        st.score += o.xp;
        st.xp += o.xp;
        st.eaten += 1;
        this.game.events.emit('float', { x, y: y - 20, text: `+${o.xp}` });

        while (st.xp >= st.xpCap) {
            st.xp -= st.xpCap;
            st.xpCap *= 2;
            st.level += 1;
            st.speedPct = Math.round(st.speedPct * PLAYER.growth);
            st.sizePct = Math.round(st.sizePct * PLAYER.growth);
            this.sound.play('player_level_up', { volume: 0.7 });
            this.game.events.emit('banner', { title: `Level ${st.level}`, subtitle: `Speed ${st.speedPct}%  ·  Size ${st.sizePct}%` });
        }
        if (st.eaten % EATEN_PER_ZONE === 0) {
            st.zone += 1;
            st.dropScale += 0.05;
            st.spawnMs *= 0.95;
            this.sound.play('level_complete', { volume: 0.6 });
            this.game.events.emit('banner', { title: `Zone ${st.zone}`, subtitle: 'The dungeon stirs…' });
        }
        this.emitStats();
    }

    explode(o, i, hitPlayer) {
        const { x, y } = o.sprite;
        this.remove(i);
        const boom = this.add.sprite(x, hitPlayer ? y : GROUND_Y - 30, 'boom1').setScale(3);
        boom.play('boom');
        boom.once('animationcomplete', () => boom.destroy());
        this.sound.play('explode', { volume: 0.6 });
        this.cameras.main.shake(hitPlayer ? 260 : 140, hitPlayer ? 0.012 : 0.004);
        if (hitPlayer) {
            this.loseLife();
        }
    }

    splat(o, i) {
        const x = o.sprite.x;
        this.remove(i);
        const splat = this.add.sprite(x, GROUND_Y, 'splat0').setOrigin(0.5, 1).setScale(2);
        this.children.moveBelow(splat, this.player);
        splat.play('splat');
        splat.once('animationcomplete', () => {
            this.tweens.add({ targets: splat, alpha: 0, delay: 600, duration: 500, onComplete: () => splat.destroy() });
        });
        this.game.events.emit('float', { x, y: GROUND_Y - 60, text: 'Missed!', color: '#ff8a7a' });
        this.loseLife();
    }

    loseLife() {
        const st = this.state;
        st.lives = Math.max(0, st.lives - 1);
        this.sound.play('lose_life', { volume: 0.7 });
        this.cameras.main.flash(180, 120, 20, 10);
        this.emitStats();
        if (st.lives === 0 && !this.over) {
            this.over = true;
            this.music.stop();
            this.time.delayedCall(700, () => {
                this.sound.play('game_over', { volume: 0.7 });
                this.game.events.emit('gameover', { ...st });
            });
        }
    }

    emitStats() {
        this.game.events.emit('stats', { ...this.state });
    }
}
