// The dungeon's air (plan §3.10): dust drifting on every floor, embers rising
// from the Underworld Depths down, and a faint flicker of firelight. Kept
// light; with reduced motion the particles stop and the light holds steady.
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { prefersReducedMotion } from '../motion';
import { COLOURS } from '../theme';
import { UI } from '../ui/kit';

/** Embers fill the air from this floor down (the Underworld Depths). */
const EMBERS_FROM_FLOOR = 7;

/** The torches on Floor 1's walls (design px), for their glow on the title screen. */
export const FLOOR_1_TORCHES: readonly { readonly x: number; readonly y: number }[] = [
    { x: 150, y: 258 },
    { x: 1770, y: 258 },
];

/** Fades a particle in and out over its life, up to `peak`. */
const fadeInOut = (peak: number) => ({
    onUpdate: (_particle: Phaser.GameObjects.Particles.Particle, _key: string, t: number) => Math.sin(Math.PI * t) * peak,
});

export class Ambience {
    private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private embers: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private readonly still = prefersReducedMotion();

    constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {
        if (!this.still) {
            this.dust = scene.add.particles(0, 0, UI.glow, {
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
            }).setDepth(depth);
            // Already drifting when the scene appears.
            this.dust.fastForward(6000);
        }
        this.addFirelight();
    }

    /** Embers on the deepest floors. */
    setFloor(floor: number): void {
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

    /** A faint warm wash over everything that flickers like firelight (steady with reduced motion). */
    private addFirelight(): void {
        const light = this.scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ember, 0.035)
            .setOrigin(0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(this.depth + 0.1);
        if (!this.still) {
            flicker(this.scene, light, 0.02, 0.06);
        }
    }
}

/** Torch glows on the title screen, flickering (steady with reduced motion). */
export function addTorchGlows(scene: Phaser.Scene, torches: readonly { readonly x: number; readonly y: number }[], depth: number): void {
    for (const { x, y } of torches) {
        const glow = scene.add.image(x, y, UI.glow).setTint(0xffb060).setDisplaySize(320, 320).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
        if (!prefersReducedMotion()) {
            flicker(scene, glow, 0.32, 0.58);
        }
    }
}

/** Keeps nudging `target`'s alpha somewhere between `low` and `high`, like a flame. */
function flicker(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { alpha: number }, low: number, high: number): void {
    const next = (): void => {
        if (!target.active) {
            return;
        }
        scene.tweens.add({
            targets: target,
            alpha: Phaser.Math.FloatBetween(low, high),
            duration: Phaser.Math.Between(80, 180),
            ease: 'Sine.InOut',
            onComplete: next,
        });
    };
    next();
}
