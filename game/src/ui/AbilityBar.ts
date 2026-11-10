import * as Phaser from 'phaser';
import { ABILITIES, COOLDOWNS, type Ability } from '../rules/abilities';
import type { Rect } from '../rules/contact';
import type { AbilityState } from '../scenes/GameScene';
import { STRINGS } from '../strings';
import { COLOURS, MOTION } from '../theme';
import { Keycap } from './Keycap';
import { UI } from './kit';

const SLOT = 84;
const GAP = 16;
const ICON = 54;
const FADED_ALPHA = 0.3;

export const ABILITY_ICONS: Readonly<Record<Ability, string>> = {
    dash: UI.iconDash,
    shadowBolt: UI.iconShadowBolt,
    tentacles: UI.iconTentacles,
    magnetism: UI.iconMagnetism,
};

interface Slot {
    readonly container: Phaser.GameObjects.Container;
    readonly icon: Phaser.GameObjects.Image;
    readonly sweep: Phaser.GameObjects.Graphics;
    readonly keycap: Keycap;
    cooling: boolean;
}

/**
 * One slot per unlocked ability, left to right from (x, y): icon, keycap and
 * a cooldown that sweeps round the slot. A new slot pops in with a glow. The
 * bar fades while the mimic is behind it.
 */
export class AbilityBar extends Phaser.GameObjects.Container {
    private readonly slots = new Map<Ability, Slot>();
    private faded = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    /** Shows the unlocked abilities and their cooldowns. With `announce`, new slots pop in. */
    sync(states: readonly AbilityState[], announce: boolean): void {
        for (const state of states) {
            if (state.unlocked && !this.slots.has(state.ability)) {
                this.addSlot(state.ability, announce);
            }
        }
        this.layOut(announce);
        for (const state of states) {
            const slot = this.slots.get(state.ability);
            if (slot) {
                this.drawCooldown(state.ability, slot, state.cooldown);
            }
        }
    }

    /** The bar's area on screen. */
    bounds(): Rect {
        const width = Math.max(0, this.slots.size * (SLOT + GAP) - GAP);
        return { x: this.x, y: this.y - SLOT / 2, width, height: SLOT + 24 };
    }

    setFaded(faded: boolean): void {
        if (faded === this.faded) {
            return;
        }
        this.faded = faded;
        this.scene.tweens.add({ targets: this, alpha: faded ? FADED_ALPHA : 1, duration: MOTION.normal });
    }

    private addSlot(ability: Ability, announce: boolean): void {
        const frame = this.scene.add.image(0, 0, UI.abilitySlot).setDisplaySize(SLOT, SLOT);
        const icon = this.scene.add.image(0, -4, ABILITY_ICONS[ability]).setDisplaySize(ICON, ICON);
        const sweep = this.scene.add.graphics();
        const keycap = new Keycap(this.scene, 0, SLOT / 2 + 2, STRINGS.abilities[ability].key, 34);
        const container = this.scene.add.container(this.slots.size * (SLOT + GAP) + SLOT / 2, 0, [frame, icon, sweep, keycap]);
        this.add(container);
        this.slots.set(ability, { container, icon, sweep, keycap, cooling: false });

        if (announce) {
            const glow = this.scene.add.image(0, 0, UI.glow).setTint(COLOURS.goldBright).setDisplaySize(SLOT * 2.2, SLOT * 2.2).setAlpha(0);
            container.addAt(glow, 0);
            container.setScale(0);
            this.scene.tweens.add({ targets: container, scale: 1, duration: MOTION.slow, ease: 'Back.Out' });
            this.scene.tweens.add({ targets: glow, alpha: { from: 0.9, to: 0 }, duration: 1800, ease: 'Sine.In', onComplete: () => glow.destroy() });
            this.scene.tweens.add({ targets: keycap, scale: 1.25, duration: 300, yoyo: true, repeat: 4, ease: 'Sine.InOut' });
        }
    }

    /** Keeps slots in ability order, sliding any that move when a new one arrives. */
    private layOut(animate: boolean): void {
        let index = 0;
        for (const ability of ABILITIES) {
            const slot = this.slots.get(ability);
            if (!slot) {
                continue;
            }
            const x = index * (SLOT + GAP) + SLOT / 2;
            if (slot.container.x !== x) {
                if (animate) {
                    this.scene.tweens.add({ targets: slot.container, x, duration: MOTION.normal, ease: MOTION.ease });
                } else {
                    slot.container.x = x;
                }
            }
            index += 1;
        }
    }

    /** A dark sweep over the remaining cooldown; the icon brightens with a pop when a long cooldown ends. */
    private drawCooldown(ability: Ability, slot: Slot, remaining: number): void {
        slot.sweep.clear();
        const cooling = remaining > 0;
        if (cooling) {
            const start = -Math.PI / 2;
            slot.sweep.fillStyle(COLOURS.ink, 0.7);
            slot.sweep.beginPath();
            slot.sweep.slice(0, 0, SLOT / 2 - 6, start, start + Math.PI * 2 * remaining, false);
            slot.sweep.fillPath();
        }
        slot.icon.setAlpha(cooling ? 0.6 : 1);
        if (slot.cooling && !cooling && COOLDOWNS[ability] >= 1000) {
            this.scene.tweens.add({ targets: slot.icon, scale: { from: slot.icon.scale * 1.25, to: slot.icon.scale }, duration: MOTION.slow, ease: 'Back.Out' });
        }
        slot.cooling = cooling;
    }
}
