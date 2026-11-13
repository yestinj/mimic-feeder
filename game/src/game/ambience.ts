// The dungeon's air (plan §3.10). Each floor has its own: dust near the top,
// a few embers from the torches lower down, spores among the roots and
// tombs, thick embers by the lava, and violet sparks at the edge of the
// void. The light sources painted into each background (torches, lanterns,
// spectral glows, lava, the void) glow and flicker or pulse in their own way.
// With reduced motion the particles stop and the lights hold steady, and
// that follows the setting as it changes.
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { prefersReducedMotion } from '../motion';
import { onProfileChange } from '../profile';
import { COLOURS } from '../theme';
import { UI } from '../ui/kit';

type LightKind = 'torch' | 'lantern' | 'spectral' | 'lava' | 'void' | 'pool';
type Air = 'dust' | 'embersLight' | 'spores' | 'embers' | 'sparks';

/**
 * How each kind of light looks and moves: colour, size, its brightness range,
 * and its waver as two layers of smooth noise: a slow sway (`rate` changes a
 * second) and, for flames, a quicker flutter on top (`flutter` of the range, at
 * `flutterRate`).
 */
interface LightLook {
    readonly tint: number;
    readonly size: number;
    readonly low: number;
    readonly high: number;
    readonly rate: number;
    readonly flutter: number;
    readonly flutterRate: number;
}

const LIGHT_LOOKS: Record<LightKind, LightLook> = {
    torch: { tint: 0xffa850, size: 320, low: 0.42, high: 0.72, rate: 1.8, flutter: 0.3, flutterRate: 7 },
    lantern: { tint: 0xffc070, size: 240, low: 0.42, high: 0.62, rate: 1.1, flutter: 0.2, flutterRate: 4.5 },
    spectral: { tint: 0x5fe0d0, size: 240, low: 0.25, high: 0.55, rate: 0.35, flutter: 0, flutterRate: 0 },
    lava: { tint: 0xff6a2a, size: 380, low: 0.3, high: 0.6, rate: 0.4, flutter: 0.15, flutterRate: 1.5 },
    void: { tint: 0x9a7bff, size: 520, low: 0.25, high: 0.5, rate: 0.25, flutter: 0, flutterRate: 0 },
    pool: { tint: 0xffd9a0, size: 700, low: 0.1, high: 0.2, rate: 0.3, flutter: 0, flutterRate: 0 },
};

/** A light grows this much (as a fraction of its size) from its dimmest to its brightest. */
const LIGHT_SWELL = 0.08;
/** How long a light fades in or out when the background changes (ms). */
const LIGHT_FADE_MS = 600;

/** A repeatable random number in [0, 1) for each whole number and seed. */
function hash(index: number, seed: number): number {
    const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/** Smooth 1D noise in [0, 1): random values at whole numbers, eased between, so it never jumps. */
function smoothNoise(t: number, seed: number): number {
    const i = Math.floor(t);
    const f = t - i;
    const eased = f * f * (3 - 2 * f);
    return hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * eased;
}

/** A light painted into a background, as fractions of the image (it's cropped and scaled to fit). */
interface Light {
    readonly u: number;
    readonly v: number;
    readonly kind: LightKind;
}

/** The light sources in each floor's background (by index in FLOORS), marked by eye. */
const BACKGROUND_LIGHTS: readonly (readonly Light[])[] = [
    // Upper Dungeon: two wall torches.
    [{ u: 0.076, v: 0.438, kind: 'torch' }, { u: 0.923, v: 0.438, kind: 'torch' }],
    // Ageing Lower Halls: a hanging lantern.
    [{ u: 0.173, v: 0.438, kind: 'lantern' }],
    // Lower Undercroft: two lanterns.
    [{ u: 0.196, v: 0.545, kind: 'lantern' }, { u: 0.829, v: 0.322, kind: 'lantern' }],
    // Buried Crypts: light pooling on the floor, and a faint glow down the side passages.
    [{ u: 0.5, v: 0.77, kind: 'pool' }, { u: 0.207, v: 0.552, kind: 'spectral' }, { u: 0.794, v: 0.552, kind: 'spectral' }],
    // Ancient Catacombs: spectral glows in the alcoves.
    [{ u: 0.104, v: 0.626, kind: 'spectral' }, { u: 0.48, v: 0.442, kind: 'spectral' }, { u: 0.48, v: 0.681, kind: 'spectral' }, { u: 0.69, v: 0.635, kind: 'spectral' }],
    // Root-Choked Necropolis: spectral glows, and embers in the cracks.
    [{ u: 0.615, v: 0.331, kind: 'spectral' }, { u: 0.256, v: 0.424, kind: 'spectral' }, { u: 0.628, v: 0.598, kind: 'spectral' }, { u: 0.33, v: 0.69, kind: 'lava' }],
    // Underworld Depths: lava falls.
    [
        { u: 0.076, v: 0.3, kind: 'lava' }, { u: 0.739, v: 0.424, kind: 'lava' }, { u: 0.918, v: 0.552, kind: 'lava' },
        { u: 0.104, v: 0.626, kind: 'lava' }, { u: 0.283, v: 0.626, kind: 'lava' }, { u: 0.649, v: 0.608, kind: 'lava' },
    ],
    // Infernal Ruins: rivers of fire.
    [
        { u: 0.177, v: 0.516, kind: 'lava' }, { u: 0.815, v: 0.497, kind: 'lava' }, { u: 0.794, v: 0.727, kind: 'lava' },
        { u: 0.076, v: 0.727, kind: 'lava' }, { u: 0.2, v: 0.313, kind: 'lava' }, { u: 0.905, v: 0.663, kind: 'lava' },
    ],
    // Void Threshold: lava at the edges, the void opening in the middle.
    [
        { u: 0.145, v: 0.424, kind: 'lava' }, { u: 0.849, v: 0.552, kind: 'lava' }, { u: 0.083, v: 0.681, kind: 'lava' },
        { u: 0.829, v: 0.7, kind: 'lava' }, { u: 0.5, v: 0.608, kind: 'void' },
    ],
    // Abyss: the void's light.
    [{ u: 0.5, v: 0.737, kind: 'void' }, { u: 0.5, v: 0.86, kind: 'void' }],
];

/** What fills the air on each floor (Floor 1 first; deeper floors use the last). */
const FLOOR_AIR: readonly (readonly Air[])[] = [
    ['dust'], ['dust'],
    ['dust', 'embersLight'], ['dust', 'embersLight'],
    ['dust', 'spores'], ['spores', 'embersLight'],
    ['embers'], ['embers'],
    ['sparks', 'embersLight'], ['sparks'],
];

/** Every background is this size, scaled to cover the screen and anchored to its bottom edge. */
const ART = { width: 1448, height: 1086 } as const;
const ART_SCALE = Math.max(DESIGN_WIDTH / ART.width, DESIGN_HEIGHT / ART.height);

/** Fades a particle in and out over its life, up to `peak`. */
const fadeInOut = (peak: number) => ({
    onUpdate: (_particle: Phaser.GameObjects.Particles.Particle, _key: string, t: number) => Math.sin(Math.PI * t) * peak,
});

const AIR_CONFIGS: Record<Air, { config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig; warm: number }> = {
    dust: {
        config: {
            x: { min: 0, max: DESIGN_WIDTH },
            y: { min: 100, max: GROUND_Y - 20 },
            lifespan: { min: 5000, max: 9000 },
            speedX: { min: -12, max: 12 },
            speedY: { min: -10, max: 4 },
            scale: { min: 0.05, max: 0.1 },
            alpha: fadeInOut(0.5),
            tint: 0xffe2b0,
            frequency: 170,
            maxAliveParticles: 48,
        },
        warm: 7000,
    },
    embersLight: {
        config: {
            x: { min: 0, max: DESIGN_WIDTH },
            y: GROUND_Y + 10,
            lifespan: { min: 2500, max: 4500 },
            speedX: { min: -20, max: 20 },
            speedY: { min: -90, max: -40 },
            accelerationX: { min: -12, max: 12 },
            scale: { start: 0.09, end: 0.015 },
            alpha: { start: 0.9, end: 0 },
            tint: [COLOURS.ember, 0xffb347],
            frequency: 420,
            maxAliveParticles: 14,
        },
        warm: 3000,
    },
    embers: {
        config: {
            x: { min: 0, max: DESIGN_WIDTH },
            y: GROUND_Y + 10,
            lifespan: { min: 2500, max: 4500 },
            speedX: { min: -20, max: 20 },
            speedY: { min: -110, max: -50 },
            accelerationX: { min: -12, max: 12 },
            scale: { start: 0.1, end: 0.015 },
            alpha: { start: 1, end: 0 },
            tint: [COLOURS.ember, 0xffb347, 0xff6a2a],
            frequency: 100,
            maxAliveParticles: 60,
        },
        warm: 3000,
    },
    spores: {
        config: {
            x: { min: 0, max: DESIGN_WIDTH },
            y: { min: 200, max: GROUND_Y },
            lifespan: { min: 7000, max: 11000 },
            speedX: { min: -6, max: 6 },
            speedY: { min: -14, max: -4 },
            accelerationX: { min: -3, max: 3 },
            scale: { min: 0.04, max: 0.08 },
            alpha: fadeInOut(0.55),
            tint: [0xc8f5e6, 0x9be8d8],
            frequency: 200,
            maxAliveParticles: 45,
        },
        warm: 9000,
    },
    sparks: {
        config: {
            x: { min: 0, max: DESIGN_WIDTH },
            y: { min: 120, max: GROUND_Y },
            lifespan: { min: 1800, max: 3200 },
            speedX: { min: -8, max: 8 },
            speedY: { min: -20, max: 6 },
            scale: { min: 0.03, max: 0.07 },
            alpha: fadeInOut(0.85),
            tint: [0xb89bff, 0x9a7bff, 0xe0d4ff],
            frequency: 90,
            maxAliveParticles: 45,
        },
        warm: 3000,
    },
};

interface Flickering {
    readonly glow: Phaser.GameObjects.Image;
    readonly look: LightLook;
    /** Its own noise, so no two lights move together. */
    readonly seed: number;
    readonly scale: number;
    /** 0 to 1 as it fades in. */
    fade: number;
}

export class Ambience {
    private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    private lights: Flickering[] = [];
    private floor = 0;
    private background = -1;
    private still = prefersReducedMotion();

    constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {
        // Reduced motion can change in Settings while this scene sits underneath.
        const stop = onProfileChange((save) => {
            if (save.settings.reducedMotion !== this.still) {
                this.still = save.settings.reducedMotion;
                this.applyMotion();
            }
        });
        // The lights are set every frame (and freeze with the scene when it's paused).
        scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateLights, this);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            stop();
            scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateLights, this);
        });
    }

    /** The floor (for what's in the air) and the background showing (for its lights; it can lag while a floor loads). */
    setFloor(floor: number, backgroundIndex: number): void {
        if (floor !== this.floor) {
            this.floor = floor;
            this.setAir();
        }
        if (backgroundIndex !== this.background) {
            this.background = backgroundIndex;
            this.setLights();
        }
    }

    private setAir(): void {
        this.emitters.forEach((emitter) => emitter.destroy());
        this.emitters = [];
        if (this.still || this.floor === 0) {
            return;
        }
        const air = FLOOR_AIR[Math.min(this.floor, FLOOR_AIR.length) - 1] ?? ['dust'];
        for (const kind of air) {
            const { config, warm } = AIR_CONFIGS[kind];
            const emitter = this.scene.add.particles(0, 0, UI.glow, { ...config, blendMode: Phaser.BlendModes.ADD }).setDepth(this.depth);
            // Already drifting when it appears.
            emitter.fastForward(warm);
            this.emitters.push(emitter);
        }
    }

    private setLights(): void {
        this.lights.forEach(({ glow }) => {
            this.scene.tweens.add({ targets: glow, alpha: 0, duration: LIGHT_FADE_MS, onComplete: () => glow.destroy() });
        });
        this.lights = (BACKGROUND_LIGHTS[this.background] ?? []).map(({ u, v, kind }, i) => {
            const look = LIGHT_LOOKS[kind];
            const x = DESIGN_WIDTH / 2 + (u - 0.5) * ART.width * ART_SCALE;
            const y = DESIGN_HEIGHT - (1 - v) * ART.height * ART_SCALE;
            const glow = this.scene.add.image(x, y, UI.glow).setTint(look.tint).setDisplaySize(look.size, look.size)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth).setAlpha(0);
            const light: Flickering = { glow, look, seed: this.background * 10 + i, scale: glow.scaleX, fade: 0 };
            this.scene.tweens.add({ targets: light, fade: 1, duration: LIGHT_FADE_MS });
            return light;
        });
        this.updateLights();
    }

    /**
     * Each light's brightness (and a touch of its size) follows its noise: a
     * torch's sway and flutter, a lantern's waver, the slow pulse of lava,
     * spirits and the void. With reduced motion they hold at the middle.
     */
    private updateLights(): void {
        const seconds = this.scene.time.now / 1000;
        for (const light of this.lights) {
            const { look, seed } = light;
            const level = this.still
                ? 0.5
                : (1 - look.flutter) * smoothNoise(seconds * look.rate, seed) + look.flutter * smoothNoise(seconds * look.flutterRate, seed + 0.5);
            light.glow.setAlpha(light.fade * (look.low + (look.high - look.low) * level));
            light.glow.setScale(light.scale * (1 - LIGHT_SWELL / 2 + LIGHT_SWELL * level));
        }
    }

    /** Particles go when motion is reduced and come back when it isn't (every floor has some); the lights follow on their next frame. */
    private applyMotion(): void {
        if (this.still ? this.emitters.length > 0 : this.emitters.length === 0) {
            this.setAir();
        }
        this.updateLights();
    }
}
