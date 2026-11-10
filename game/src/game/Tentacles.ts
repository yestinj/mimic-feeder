import * as Phaser from 'phaser';
import { TEXTURES } from '../assets';
import { SIZE_SCALE } from '../config';
import type { FallingObject } from './FallingObject';

/** Chains reach their targets in 0.5 s, then pull them into the mouth over 1 s (inventory §6). */
const REACH_MS = 500;
const PULL_MS = 1000;
/** The chain art drawn at a quarter of its width, as in the p5 game. */
const CHAIN_SCALE = 0.25 * SIZE_SCALE;

interface Grab {
    readonly target: FallingObject;
    readonly chain: Phaser.GameObjects.TileSprite;
    /** 0–1 while the chain reaches out. */
    reach: number;
    /** Where the target was when the pull began, and how far the pull has got (ms). */
    pullFrom: { x: number; y: number } | null;
    pulled: number;
}

/** The tentacles' chains: each reaches a creature, then reels it into the mouth. */
export class Tentacles {
    private grabs: Grab[] = [];

    constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {}

    get active(): boolean {
        return this.grabs.length > 0;
    }

    lash(targets: readonly FallingObject[]): void {
        for (const target of targets) {
            const chain = this.scene.add.tileSprite(target.x, target.y, this.chainWidth(), 1, TEXTURES.chain)
                .setOrigin(0.5, 0)
                .setScale(CHAIN_SCALE)
                .setDepth(this.depth);
            this.grabs.push({ target, chain, reach: 0, pullFrom: null, pulled: 0 });
        }
    }

    /**
     * Moves the chains on by `delta` ms, from the mouth at (x, y). A target that
     * reaches the mouth is passed to `eaten`; one that's gone (eaten, shot or
     * hit side-on first) just lets its chain go.
     */
    update(delta: number, x: number, y: number, eaten: (target: FallingObject) => void): void {
        for (const grab of [...this.grabs]) {
            const { target } = grab;
            if (!target.active) {
                this.release(grab);
                continue;
            }
            let length: number;
            if (!grab.pullFrom) {
                grab.reach = Math.min(1, grab.reach + delta / REACH_MS);
                length = grab.reach;
                if (grab.reach >= 1) {
                    grab.pullFrom = { x: target.x, y: target.y };
                    target.grab();
                }
            } else {
                grab.pulled += delta;
                const progress = Phaser.Math.Easing.Quadratic.In(Math.min(1, grab.pulled / PULL_MS));
                target.setPosition(
                    Phaser.Math.Linear(grab.pullFrom.x, x, progress),
                    Phaser.Math.Linear(grab.pullFrom.y, y, progress),
                );
                length = 1;
                if (grab.pulled >= PULL_MS) {
                    this.release(grab);
                    eaten(target);
                    continue;
                }
            }
            this.drawChain(grab.chain, x, y, target.x, target.y, length);
        }
    }

    clear(): void {
        [...this.grabs].forEach((grab) => this.release(grab));
    }

    private drawChain(chain: Phaser.GameObjects.TileSprite, fromX: number, fromY: number, toX: number, toY: number, fraction: number): void {
        const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY) * fraction;
        chain.setPosition(fromX, fromY);
        chain.setSize(this.chainWidth(), Math.max(1, distance / CHAIN_SCALE));
        // The chain hangs along its local +y; turn it to point at the target.
        chain.setRotation(Phaser.Math.Angle.Between(fromX, fromY, toX, toY) - Math.PI / 2);
    }

    private chainWidth(): number {
        return this.scene.textures.getFrame(TEXTURES.chain).width;
    }

    private release(grab: Grab): void {
        grab.chain.destroy();
        this.grabs = this.grabs.filter((other) => other !== grab);
    }
}
