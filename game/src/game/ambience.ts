// The dungeon's air (plan §3.10): dust drifting on every floor, embers rising
// from the Underworld Depths down, a faint flicker of firelight, and (on the
// title) glows on the wall torches. Kept light; with reduced motion the
// particles stop and the light holds steady, and that follows the setting
// as it changes.
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { prefersReducedMotion } from '../motion';
import { onProfileChange } from '../profile';
import { COLOURS } from '../theme';
import { UI } from '../ui/kit';

/** Embers fill the air from this floor down (the Underworld Depths). */
const EMBERS_FROM_FLOOR = 7;

/** The torches on Floor 1's walls (design px), for their glow on the title screen. */
export const FLOOR_1_TORCHES: readonly { readonly x: number; readonly y: number }[] = [
    { x: 150, y: 258 },
    { x: 1770, y: 258 },
];

/** Alpha ranges for the flicker, and the steady level with reduced motion. */
const FIRELIGHT = { low: 0.02, high: 0.06, steady: 0.035 } as const;
const TORCH = { low: 0.32, high: 0.58, steady: 0.45 } as const;

/** Fades a particle in and out over its life, up to `peak`. */
const fadeInOut = (peak: number) => ({
    onUpdate: (_particle: Phaser.GameObjects.Particles.Particle, _key: string, t: number) => Math.sin(Math.PI * t) * peak,
});

interface Flickering {
    readonly target: Phaser.GameObjects.GameObject & { alpha: number };
    readonly low: number;
    readonly high: number;
    readonly steady: number;
    goal: number;
}

export class Ambience {
    private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private embers: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private readonly flickering: Flickering[] = [];
    private flickerTimer: Phaser.Time.TimerEvent | null = null;
    private floor = 1;
    private still = prefersReducedMotion();

    constructor(private readonly scene: Phaser.Scene, private readonly depth: number, torches: readonly { readonly x: number; readonly y: number }[] = []) {
        const light = scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ember, FIRELIGHT.steady)
            .setOrigin(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth + 0.1);
        this.flickering.push({ target: light, ...FIRELIGHT, goal: FIRELIGHT.steady });
        for (const { x, y } of torches) {
            const glow = scene.add.image(x, y, UI.glow).setTint(0xffb060).setDisplaySize(320, 320).setAlpha(TORCH.steady).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
            this.flickering.push({ target: glow, ...TORCH, goal: TORCH.steady });
        }
        this.applyMotion();
        // Reduced motion can change in Settings while this scene sits underneath.
        const stop = onProfileChange((save) => {
            if (save.settings.reducedMotion !== this.still) {
                this.still = save.settings.reducedMotion;
                this.applyMotion();
            }
        });
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    }

    /** Embers on the deepest floors. */
    setFloor(floor: number): void {
        this.floor = floor;
        const wanted = floor >= EMBERS_FROM_FLOOR && !this.still;
        if (wanted && !this.embers) {
            this.embers = this.scene.add.particles(0, 0, UI.glow, {
                x: { min: 0, max: DESIGN_WIDTH },
                y: GROUND_Y + 10,
                lifespan: { min: 2500, max: 4500 },
                speedX: { min: -20, max: 20 },
                speedY: { min: -110, max: -50 },
                accelerationX: { min: -12, max: 12 },
                scale: { start: 0.1, end: 0.015 },
                alpha: { start: 1, end: 0 },
                tint: [COLOURS.ember, 0xffb347, 0xff6a2a],
                blendMode: Phaser.BlendModes.ADD,
                frequency: 100,
                maxAliveParticles: 60,
            }).setDepth(this.depth);
            this.embers.fastForward(3000);
        } else if (!wanted && this.embers) {
            this.embers.destroy();
            this.embers = null;
        }
    }

    /** Starts or stops what moves: the dust, the embers and the flicker. */
    private applyMotion(): void {
        if (this.still) {
            this.dust?.destroy();
            this.dust = null;
            this.flickerTimer?.remove();
            this.flickerTimer = null;
            this.flickering.forEach((item) => {
                item.target.alpha = item.steady;
            });
        } else {
            this.dust ??= this.addDust();
            // One timer eases each light towards a goal, and now and then picks a new one: a flame's waver.
            this.flickerTimer ??= this.scene.time.addEvent({
                delay: 40,
                loop: true,
                callback: () => {
                    for (const item of this.flickering) {
                        if (Math.random() < 0.12) {
                            item.goal = Phaser.Math.FloatBetween(item.low, item.high);
                        }
                        item.target.alpha += (item.goal - item.target.alpha) * 0.3;
                    }
                },
            });
        }
        this.setFloor(this.floor);
    }

    private addDust(): Phaser.GameObjects.Particles.ParticleEmitter {
        const dust = this.scene.add.particles(0, 0, UI.glow, {
            x: { min: 0, max: DESIGN_WIDTH },
            y: { min: 120, max: GROUND_Y - 20 },
            lifespan: { min: 5000, max: 9000 },
            speedX: { min: -10, max: 10 },
            speedY: { min: -8, max: 3 },
            scale: { min: 0.03, max: 0.07 },
            alpha: fadeInOut(0.4),
            tint: 0xffe2b0,
            blendMode: Phaser.BlendModes.ADD,
            frequency: 220,
            maxAliveParticles: 40,
        }).setDepth(this.depth);
        // Already drifting when it appears.
        dust.fastForward(6000);
        return dust;
    }
}
